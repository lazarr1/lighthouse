import { useCallback, useMemo, useRef, useState } from 'react';
import { Navigate, useParams, useSearchParams } from 'react-router';
import { describeError, hasCode } from '@/api/client';
import type { Dataset, DataRecord, Filter, RecordSort } from '@/api/contract';
import { cx } from '@/lib/cx';
import { displayText } from '@/lib/fieldValues';
import { formatCount, plural } from '@/lib/format';
import { useDebouncedValue, useLocalPreference, useMediaQuery } from '@/lib/hooks';
import { Button, EmptyState, ErrorState, Icon, LoadingState, PageHeader, useToast } from '@/ui';
import { useWorkspace } from '../workspace/WorkspaceContext';
import styles from './DataPage.module.css';
import { FilterPanel } from './FilterPanel';
import { DataGrid, type CellChange } from './grid/DataGrid';
import { useCreateRecord, useDataset, useRecords, useRevertChangeSet, useUpdateRecord } from './hooks';
import { RecordDrawer } from './RecordDrawer';
import { SchemaDialog } from './SchemaDialog';

export function DataPage() {
  const { workspace } = useWorkspace();
  const { datasetId } = useParams();
  const fallback = workspace.datasets[0]?.id;
  if (!datasetId) {
    return fallback ? (
      <Navigate to={fallback} replace />
    ) : (
      <EmptyState icon="table" title="No data yet">
        Import a CSV to create your first dataset.
      </EmptyState>
    );
  }
  return <DatasetView key={datasetId} datasetId={datasetId} />;
}

function DatasetView({ datasetId }: { datasetId: string }) {
  const dataset = useDataset(datasetId);
  if (dataset.isPending) return <LoadingState label="Loading data…" />;
  if (dataset.isError) return <ErrorState error={dataset.error} onRetry={() => dataset.refetch()} />;
  return <DatasetEditor dataset={dataset.data} />;
}

function DatasetEditor({ dataset }: { dataset: Dataset }) {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const onlyWithIssues = params.get('issues') === '1';
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<RecordSort | null>(null);
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [widths, setWidths] = useLocalPreference<Record<string, number>>(
    `lighthouse.columns.${dataset.id}`,
    {},
  );
  const undoStack = useRef<string[]>([]);
  const compact = useMediaQuery('(max-width: 640px)');

  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const query = useMemo(
    () => ({ search: debouncedSearch || undefined, filters, sort: sort ? [sort] : [], onlyWithIssues }),
    [debouncedSearch, filters, sort, onlyWithIssues],
  );
  const records = useRecords(dataset.id, query);
  const update = useUpdateRecord(dataset.id);
  const create = useCreateRecord(dataset.id);
  const revert = useRevertChangeSet(dataset.id);

  const fields = useMemo(() => {
    const active = dataset.fields.filter((field) => field.status === 'active');
    // Primary field first, like a frozen first column.
    return [
      ...active.filter((f) => f.id === dataset.primaryFieldId),
      ...active.filter((f) => f.id !== dataset.primaryFieldId),
    ];
  }, [dataset.fields, dataset.primaryFieldId]);
  const rows = useMemo(() => records.data?.pages.flatMap((page) => page.items) ?? [], [records.data]);
  const total = records.data?.pages[0]?.totalCount ?? 0;
  const openRecord = rows.find((record) => record.id === openRecordId) ?? null;

  const undo = useCallback(
    (changeSetId?: string) => {
      const id = changeSetId ?? undoStack.current.pop();
      if (!id) return toast.show({ message: 'Nothing to undo.', tone: 'info' });
      revert.mutate(id, {
        onSuccess: () => toast.success('Change undone.'),
        onError: (error) => toast.error(describeError(error)),
      });
    },
    [revert, toast],
  );

  const commit = useCallback(
    (changes: CellChange[]) => {
      for (const change of changes) {
        update.mutate(change, {
          onSuccess: (result) => {
            undoStack.current.push(result.changeSetId);
            if (changes.length === 1)
              toast.success('Cell updated.', { label: 'Undo', onClick: () => undo(result.changeSetId) });
          },
          onError: (error) => {
            if (hasCode(error, 'revision_conflict'))
              toast.error(
                'Someone else edited this record just now. Their version is shown — try your change again.',
              );
            else if (hasCode(error, 'validation_failed')) {
              const messages = Object.values((error.details.fields ?? {}) as Record<string, string>);
              toast.error(messages[0] ?? describeError(error));
            } else toast.error(describeError(error));
          },
        });
      }
      if (changes.length > 1) toast.success(`Pasted into ${plural(changes.length, 'record')}.`);
    },
    [toast, undo, update],
  );

  const addRecord = () =>
    create.mutate(
      {},
      {
        onSuccess: ({ record, changeSetId }) => {
          undoStack.current.push(changeSetId);
          setOpenRecordId(record.id);
          toast.success('New record added.');
        },
        onError: (error) => toast.error(describeError(error)),
      },
    );

  const activeFilterCount = filters.length + (onlyWithIssues ? 1 : 0);

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Source data"
        title={dataset.name}
        note={
          dataset.description || 'Edit cells directly, or ask the assistant to transform the data for you.'
        }
        actions={
          <>
            <Button icon="columns" onClick={() => setSchemaOpen(true)}>
              Manage fields
            </Button>
            <Button variant="primary" icon="plus" loading={create.isPending} onClick={addRecord}>
              New record
            </Button>
          </>
        }
      />

      <section className={styles.surface} aria-label={`${dataset.name} records`}>
        <header className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <span className={styles.tableName}>
              <span className={styles.tableIcon}>
                <Icon name="table" size={15} />
              </span>
              {dataset.name}
            </span>
            <span className={styles.divider} />
            <span className={styles.count} aria-live="polite">
              {records.isFetching && !records.isFetchingNextPage
                ? 'Updating…'
                : `${formatCount(total)} of ${plural(dataset.recordCount, 'record')}`}
            </span>
          </div>
          <div className={styles.toolbarRight}>
            <label className={styles.search}>
              <Icon name="search" size={15} />
              <input
                type="search"
                placeholder="Search data"
                aria-label="Search data"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {onlyWithIssues ? (
              <Button size="sm" variant="secondary" icon="close" onClick={() => setParams({})}>
                Needs review
              </Button>
            ) : null}
            <Button
              size="sm"
              icon="filter"
              variant={filters.length ? 'secondary' : 'quiet'}
              onClick={() => setFiltersOpen(true)}
            >
              {filters.length ? `Filtered (${filters.length})` : 'Filter'}
            </Button>
            {sort ? (
              <Button
                size="sm"
                variant="secondary"
                icon="close"
                onClick={() => setSort(null)}
                aria-label="Clear sort"
              >
                Sorted by {fields.find((field) => field.id === sort.fieldId)?.name}{' '}
                {sort.direction === 'asc' ? '↑' : '↓'}
              </Button>
            ) : null}
          </div>
        </header>

        <div className={cx(styles.gridArea, compact && styles.cardArea)}>
          {records.isPending ? (
            <LoadingState label="Loading records…" />
          ) : records.isError ? (
            <ErrorState error={records.error} onRetry={() => records.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState icon="search" title="No matching records">
              {activeFilterCount || search
                ? 'Try a different search or clear your filters.'
                : 'Add a record or ask the assistant to import some.'}
            </EmptyState>
          ) : compact ? (
            <RecordCards
              dataset={dataset}
              records={rows}
              onOpen={(record) => setOpenRecordId(record.id)}
              hasMore={!!records.hasNextPage}
              loadingMore={records.isFetchingNextPage}
              onLoadMore={() => records.fetchNextPage()}
            />
          ) : (
            <DataGrid
              fields={fields}
              records={rows}
              totalCount={total}
              hasMore={!!records.hasNextPage}
              loadingMore={records.isFetchingNextPage}
              onLoadMore={() => void records.fetchNextPage()}
              sort={sort}
              onSortChange={setSort}
              onCommit={commit}
              onOpenRecord={(record) => setOpenRecordId(record.id)}
              onUndo={() => undo()}
              onProblem={(message) => toast.error(message)}
              columnWidths={widths}
              onColumnWidthsChange={setWidths}
            />
          )}
        </div>

        <footer className={styles.footer}>
          <span>
            <b>{formatCount(rows.length)}</b> loaded
          </span>
          <span className={styles.tips}>
            <kbd>↵</kbd> edit · <kbd>⇧</kbd>
            <kbd>↵</kbd> open record · <kbd>⌘</kbd>
            <kbd>D</kbd> fill down · <kbd>⌘</kbd>
            <kbd>Z</kbd> undo
          </span>
        </footer>
      </section>

      <RecordDrawer dataset={dataset} record={openRecord} onClose={() => setOpenRecordId(null)} />
      {filtersOpen ? (
        <FilterPanel
          open
          onClose={() => setFiltersOpen(false)}
          fields={fields}
          filters={filters}
          onApply={setFilters}
        />
      ) : null}
      <SchemaDialog open={schemaOpen} onClose={() => setSchemaOpen(false)} dataset={dataset} />
    </div>
  );
}

/** Phone layout: record cards instead of a squeezed spreadsheet (design §10). */
function RecordCards({
  dataset,
  records,
  onOpen,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  dataset: Dataset;
  records: DataRecord[];
  onOpen: (record: DataRecord) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const fields = dataset.fields.filter((field) => field.status === 'active');
  const primary = fields.find((field) => field.id === dataset.primaryFieldId) ?? fields[0];
  const secondary = fields.filter((field) => field !== primary).slice(0, 3);
  return (
    <div className={styles.cards}>
      {records.map((record) => (
        <button key={record.id} type="button" className={styles.card} onClick={() => onOpen(record)}>
          <strong>
            {primary ? displayText(primary, record.values[primary.id]) || 'Untitled' : record.id}
          </strong>
          {secondary.map((field) => (
            <span key={field.id}>
              <em>{field.name}</em> {displayText(field, record.values[field.id]) || '—'}
            </span>
          ))}
          {record.issues.length ? (
            <span className={styles.cardIssue}>{record.issues[0]?.message}</span>
          ) : null}
        </button>
      ))}
      {hasMore ? (
        <Button loading={loadingMore} onClick={onLoadMore}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}
