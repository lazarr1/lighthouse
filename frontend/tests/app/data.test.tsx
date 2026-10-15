import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LEADS_ID } from '@/mocks/fixtures';
import { renderApp, ws } from '../renderApp';
import { testDb } from '../testBackend';

const openData = async (path = ws(`/data/${LEADS_ID}`), firstCompany = 'Northstar Labs') => {
  const app = renderApp(path);
  const grid = await screen.findByRole('grid', { name: 'Records' });
  if (firstCompany) await within(grid).findByText(firstCompany);
  return { ...app, grid };
};

const cell = (grid: HTMLElement, row: number, col: number) =>
  within(grid).getAllByRole('row')[row + 1]!.querySelectorAll('[role="gridcell"]')[col] as HTMLElement;

describe('Data view', () => {
  it('shows typed columns and server-paged rows', async () => {
    const { grid } = await openData();
    expect(within(grid).getByRole('columnheader', { name: /Company/ })).toBeInTheDocument();
    expect(within(grid).getByRole('columnheader', { name: /Value/ })).toBeInTheDocument();
    expect(screen.getByText(/300 of 300 records/)).toBeInTheDocument();
    expect(cell(grid, 0, 4)).toHaveTextContent(/18,400/);
    expect(within(cell(grid, 0, 3)).getByText('Qualified')).toBeInTheDocument();
  });

  it('edits a cell with the keyboard and saves with If-Match', async () => {
    const { user, grid } = await openData();
    await user.click(cell(grid, 0, 0));
    await user.keyboard('{Enter}');
    const editor = within(grid).getByRole('textbox', { name: 'Edit Company' });
    await user.clear(editor);
    await user.type(editor, 'Northstar Robotics{Enter}');
    await waitFor(() =>
      expect(testDb().records.find((r) => r.id === 'rec_00001')?.values.fld_company).toBe(
        'Northstar Robotics',
      ),
    );
    expect(testDb().records.find((r) => r.id === 'rec_00001')?.revision).toBe(2);
    // Enter moved selection down one row.
    expect(cell(grid, 1, 0)).toHaveAttribute('aria-selected', 'true');
  });

  it('rejects invalid input in place without saving', async () => {
    const { user, grid } = await openData();
    await user.click(cell(grid, 0, 4));
    await user.keyboard('abc{Enter}');
    expect(await within(grid).findByRole('alert')).toHaveTextContent('Enter a number');
    expect(testDb().records[0]?.values.fld_value).toBe(18400);
    await user.keyboard('{Escape}');
    expect(within(grid).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('undoes an edit from the toast', async () => {
    const { user, grid } = await openData();
    await user.click(cell(grid, 0, 4));
    await user.keyboard('5000{Enter}');
    await waitFor(() => expect(testDb().records[0]?.values.fld_value).toBe(5000));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(testDb().records[0]?.values.fld_value).toBe(18400));
  });

  it('recovers from a concurrent edit (revision conflict)', async () => {
    const { user, grid } = await openData();
    // Someone else edits the record after we loaded it.
    testDb().updateRecord(LEADS_ID, 'rec_00001', { fld_contact: 'Changed Elsewhere' }, 1);
    await user.click(cell(grid, 0, 0));
    await user.keyboard('{Enter}');
    const editor = within(grid).getByRole('textbox', { name: 'Edit Company' });
    await user.clear(editor);
    await user.type(editor, 'Mine{Enter}');
    expect(await screen.findByText(/Someone else edited this record/)).toBeInTheDocument();
    await waitFor(() => expect(cell(grid, 0, 1)).toHaveTextContent('Changed Elsewhere'));
    expect(testDb().records[0]?.values.fld_company).toBe('Northstar Labs');
  });

  it('pastes a TSV block across cells and skips invalid values', async () => {
    const { user, grid } = await openData();
    await user.click(cell(grid, 0, 4));
    fireEvent.paste(grid, { clipboardData: { getData: () => '100\n200\nnot-a-number\n' } });
    await waitFor(() => expect(testDb().records[1]?.values.fld_value).toBe(200));
    expect(testDb().records[0]?.values.fld_value).toBe(100);
    expect(testDb().records[2]?.values.fld_value).not.toBe(null);
    expect(await screen.findByText(/1 pasted value didn’t match/)).toBeInTheDocument();
  });

  it('fills down with ⌘D and sorts by column header', async () => {
    const { user, grid } = await openData();
    await user.click(cell(grid, 1, 3));
    await user.keyboard('{Meta>}d{/Meta}');
    await waitFor(() => expect(testDb().records[1]?.values.fld_stage).toBe('stg_qualified'));

    await user.click(within(grid).getByRole('button', { name: /^Value$/ }));
    await waitFor(() =>
      expect(within(grid).getByRole('columnheader', { name: /Value/ })).toHaveAttribute(
        'aria-sort',
        'ascending',
      ),
    );
  });

  it('searches, filters to records needing review, and opens a record', async () => {
    const { user } = await openData(ws(`/data/${LEADS_ID}?issues=1`), '');
    const grid = screen.getByRole('grid', { name: 'Records' });
    const expected = testDb().records.filter((r) => r.issues.length).length;
    await waitFor(() => expect(screen.getByText(new RegExp(`^${expected} of 300`))).toBeInTheDocument());

    await user.click(within(grid).getAllByRole('button', { name: /Open record/ })[0]!);
    const drawer = await screen.findByRole('dialog', { name: 'Record details' });
    expect(within(drawer).getByText('Contact is missing')).toBeInTheDocument();
    await user.type(within(drawer).getByLabelText(/^Contact/), 'Pat Doe');
    await user.click(within(drawer).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(testDb().records.filter((r) => r.issues.length).length).toBe(expected - 1));
  });

  it('renames a field safely and reviews a risky type change', async () => {
    const { user } = await openData();
    await user.click(screen.getByRole('button', { name: 'Manage fields' }));
    const dialog = await screen.findByRole('dialog', { name: 'Manage fields' });
    await user.click(within(dialog).getByRole('button', { name: 'Rename Value' }));
    const input = within(dialog).getByRole('textbox', { name: 'New name for Value' });
    await user.clear(input);
    await user.type(input, 'Deal size{Enter}');
    await waitFor(() =>
      expect(testDb().dataset.fields.find((f) => f.id === 'fld_value')?.name).toBe('Deal size'),
    );

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Type of Deal size' }), 'text');
    const review = await screen.findByRole('dialog', { name: 'Review this change' });
    expect(within(review).getByText(/chart.* will need attention/)).toBeInTheDocument();
    expect(within(review).getByText('Revenue by month')).toBeInTheDocument();
    await user.click(within(review).getByRole('button', { name: 'Apply change' }));
    await waitFor(() => expect(testDb().dataset.fields.find((f) => f.id === 'fld_value')?.type).toBe('text'));
  });

  it('adds a record and opens it for editing', async () => {
    const { user } = await openData();
    await user.click(screen.getByRole('button', { name: 'New record' }));
    expect(await screen.findByRole('dialog', { name: 'Record details' })).toBeInTheDocument();
    expect(testDb().records.length).toBe(301);
  });
});
