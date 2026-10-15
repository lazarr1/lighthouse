import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../renderApp';
import { testDb } from '../testBackend';

describe('Dashboard', () => {
  it('renders seeded widgets with live data', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    const total = await screen.findByRole('article', { name: 'Total records' });
    expect(await within(total).findByRole('img', { name: /Total records: 300/ })).toBeInTheDocument();
    expect(
      await screen.findByRole('img', { name: /Opportunities by stage\. Values: Prospecting/ }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /Quality score \d+ out of 100/ })).toBeInTheDocument();
  });

  it('builds a chart with AI, previews it, and adds it', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Add chart with AI' }));
    const dialog = await screen.findByRole('dialog', { name: 'Describe the chart you need' });
    await user.click(within(dialog).getByRole('button', { name: 'Pipeline value by owner' }));
    expect(await within(dialog).findByRole('heading', { name: 'Value by owner' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('img', { name: /Value by owner\. Values: Priya Shah/ }),
    ).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: 'Refine the chart' }), 'as a donut');
    await user.click(within(dialog).getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(within(dialog).getByText('Donut chart')).toBeInTheDocument());

    await user.click(within(dialog).getByRole('button', { name: 'Add to dashboard' }));
    expect(await screen.findByRole('article', { name: 'Value by owner' })).toBeInTheDocument();
    expect(testDb().dashboard.widgets.some((w) => w.kind === 'chart' && w.definition.type === 'donut')).toBe(
      true,
    );
  });

  it('removes a widget and restores it with undo', async () => {
    const { user } = renderApp();
    const card = await screen.findByRole('article', { name: 'Leads by source' });
    await user.click(within(card).getByRole('button', { name: 'Leads by source options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Remove from dashboard' }));
    await waitFor(() =>
      expect(screen.queryByRole('article', { name: 'Leads by source' })).not.toBeInTheDocument(),
    );
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByRole('article', { name: 'Leads by source' })).toBeInTheDocument();
  });

  it('offers keyboard move/resize in edit mode and saves the layout', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Edit layout' }));
    const card = await screen.findByRole('article', { name: 'Pipeline value' });
    const before = testDb().dashboard.version;
    await user.click(within(card).getByRole('button', { name: 'Pipeline value options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move earlier' }));
    await waitFor(() => expect(testDb().dashboard.version).toBe(before + 1));
    const lg = testDb().dashboard.layouts.lg;
    expect(lg.find((i) => i.i === 'wdg_pipeline')?.x).toBe(0);
    expect(lg.find((i) => i.i === 'wdg_total')?.x).toBe(4);
  });

  it('shows the underlying data table for a chart', async () => {
    const { user } = renderApp();
    const card = await screen.findByRole('article', { name: 'Opportunities by stage' });
    await user.click(within(card).getByRole('button', { name: 'Opportunities by stage options' }));
    await user.click(screen.getByRole('menuitem', { name: 'View data' }));
    const dialog = await screen.findByRole('dialog', { name: 'Opportunities by stage' });
    expect(await within(dialog).findByRole('columnheader', { name: 'Stage' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('row').length).toBeGreaterThan(1);
  });
});
