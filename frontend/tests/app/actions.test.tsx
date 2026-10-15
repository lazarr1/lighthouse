import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, ws } from '../renderApp';
import { testDb } from '../testBackend';

async function openAssistant(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Show assistant' }));
  return screen.findByRole('complementary', { name: 'Assistant' });
}

describe('Assistant', () => {
  it('plans, previews, approves and runs an action, then undoes it', async () => {
    const { user } = renderApp();
    const panel = await openAssistant(user);
    await user.type(
      within(panel).getByRole('textbox', { name: /Ask Lighthouse/ }),
      'Find new companies like our customers{Enter}',
    );

    const plan = await within(panel).findByRole('region', { name: 'Research and add matching companies' });
    expect(within(plan).getByText('HTTPS GET only')).toBeInTheDocument();
    expect(within(plan).getByText('Nothing changes until you approve.')).toBeInTheDocument();
    const before = testDb().records.length;

    await user.click(within(plan).getByRole('button', { name: 'Preview changes' }));
    expect(await within(plan).findByText('6 new')).toBeInTheDocument();
    expect(within(plan).getByText(/nothing has been saved yet/)).toBeInTheDocument();
    expect(testDb().records.length).toBe(before);

    await user.click(within(plan).getByRole('button', { name: 'Approve & run' }));
    expect(await within(plan).findByText(/Done — 6 records added/)).toBeInTheDocument();
    expect(testDb().records.length).toBe(before + 6);
    expect(within(plan).getByRole('link', { name: /Open in Actions/ })).toBeInTheDocument();

    await user.click(within(plan).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(testDb().records.length).toBe(before));
  });

  it('asks clarifying questions and uses the follow-up as context', async () => {
    const { user } = renderApp();
    const panel = await openAssistant(user);
    const composer = within(panel).getByRole('textbox', { name: /Ask Lighthouse/ });
    await user.type(composer, 'help me{Enter}');
    expect(await within(panel).findByText(/add new records to Leads/)).toBeInTheDocument();
    await user.type(composer, 'clean up duplicates{Enter}');
    expect(
      await within(panel).findByRole('region', { name: 'Review duplicate records' }),
    ).toBeInTheDocument();
    const drafts = [...testDb().actionDrafts.values()];
    expect(drafts.at(-1)?.prompt).toContain('help me');
  });

  it('refuses unsafe requests with a reason', async () => {
    const { user } = renderApp();
    const panel = await openAssistant(user);
    await user.type(
      within(panel).getByRole('textbox', { name: /Ask Lighthouse/ }),
      'delete all records{Enter}',
    );
    expect(await within(panel).findByText(/can’t delete records in bulk/)).toBeInTheDocument();
  });

  it('uploads an image attachment and plans an extraction', async () => {
    const { user } = renderApp();
    const panel = await openAssistant(user);
    const file = new File(['png'], 'harbor-logistics.png', { type: 'image/png' });
    await user.upload(panel.querySelector('input[type="file"]') as HTMLInputElement, file);
    await waitFor(() => expect(within(panel).getByRole('button', { name: 'Send' })).toBeEnabled());
    await user.click(within(panel).getByRole('button', { name: 'Send' }));
    const plan = await within(panel).findByRole('region', { name: 'Extract a record from your image' });
    await user.click(within(plan).getByRole('button', { name: 'Preview changes' }));
    expect(await within(plan).findByText('Harbor Logistics')).toBeInTheDocument();
  });
});

describe('Actions page', () => {
  it('lists actions and shows details, permissions and run history', async () => {
    const { user } = renderApp(ws('/actions/act_enrich'));
    const detail = await screen.findByRole('article', { name: 'Weekly lead enrichment' });
    expect(within(detail).getByText('HTTPS GET only')).toBeInTheDocument();
    expect(within(detail).getAllByText('h_enrich_v2').length).toBeGreaterThan(0);
    const runs = await within(detail).findAllByRole('button', { pressed: false });
    const failed = runs.find((button) => button.textContent?.includes('Failed'));
    await user.click(failed!);
    expect(await within(detail).findByText(/directory API was unavailable/)).toBeInTheDocument();
  });

  it('starts a manual run and streams it to completion', async () => {
    const { user } = renderApp(ws('/actions/act_enrich'));
    const detail = await screen.findByRole('article', { name: 'Weekly lead enrichment' });
    await user.click(within(detail).getByRole('button', { name: 'Run now' }));
    const panel = await within(detail).findByLabelText('Run details');
    await waitFor(() => expect(within(panel).getByText('Succeeded')).toBeInTheDocument());
  });

  it('pauses (kill switch) and blocks runs, and approves a schedule separately', async () => {
    const { user } = renderApp(ws('/actions/act_dedupe'));
    const detail = await screen.findByRole('article', { name: 'Clean duplicate leads' });
    expect(within(detail).getByRole('button', { name: 'Run now' })).toBeDisabled();
    await user.selectOptions(within(detail).getByRole('combobox', { name: 'Schedule' }), 'weekdays');
    await user.click(within(detail).getByRole('button', { name: 'Approve schedule' }));
    await waitFor(() => expect(testDb().actions.get('act_dedupe')?.schedule?.cron).toBe('0 9 * * 1-5'));
    await user.click(within(detail).getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(within(detail).getByRole('button', { name: 'Run now' })).toBeEnabled());
  });
});

describe('Routing', () => {
  it('redirects / to the first workspace dashboard and shows not found for bad workspaces', async () => {
    const { router } = renderApp('/');
    await waitFor(() => expect(router.state.location.pathname).toBe(ws('/dashboard')));
    renderApp('/w/nope/dashboard');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });

  it('renders the API contract explorer', async () => {
    const { user } = renderApp('/dev/api');
    await user.click(
      await screen.findByRole('button', {
        name: /PATCH \/v1\/datasets\/\{datasetId\}\/records\/\{recordId\}/,
      }),
    );
    expect(screen.getByText(/operationId: updateRecord/)).toBeInTheDocument();
    expect(screen.getByText('If-Match')).toBeInTheDocument();
  });
});
