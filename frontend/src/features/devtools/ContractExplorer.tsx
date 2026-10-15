import { useMemo, useState } from 'react';
import { buildOpenApiDocument } from '@/api/contract/openapi';
import { cx } from '@/lib/cx';
import { Button, PageHeader } from '@/ui';
import styles from './ContractExplorer.module.css';

type Operation = {
  operationId: string;
  tags: string[];
  summary: string;
  parameters: { name: string; in: string; required: boolean; description?: string }[];
  requestBody?: { content: Record<string, { schema: unknown }> };
  responses: Record<string, { description: string; content?: Record<string, { schema: unknown }> }>;
};

/**
 * Developer view of the API contract this client depends on, generated live
 * from the Zod schemas (the same source as docs/openapi.json).
 */
export function ContractExplorer() {
  const document = useMemo(() => buildOpenApiDocument(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const operations = Object.entries(document.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({
      path,
      method: method.toUpperCase(),
      operation: operation as unknown as Operation,
    })),
  );
  const visible = operations.filter(({ path, operation }) =>
    `${path} ${operation.summary} ${operation.operationId}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const tags = [...new Set(visible.flatMap(({ operation }) => operation.tags))];
  const current = operations.find(({ operation }) => operation.operationId === selected);

  const download = () => {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(window.document.createElement('a'), { href: url, download: 'openapi.json' });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Developer"
        title="API contract"
        note={`${operations.length} operations · ${Object.keys(document.components.schemas).length} schemas · generated from src/api/contract`}
        actions={
          <Button icon="arrowDown" onClick={download}>
            Download openapi.json
          </Button>
        }
      />
      <div className={styles.layout}>
        <nav className={styles.list} aria-label="Operations">
          <input
            className={styles.filter}
            placeholder="Filter operations"
            aria-label="Filter operations"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          {tags.map((tag) => (
            <section key={tag}>
              <h2>{tag}</h2>
              {visible
                .filter(({ operation }) => operation.tags.includes(tag))
                .map(({ path, method, operation }) => (
                  <button
                    key={operation.operationId}
                    type="button"
                    className={cx(styles.op, selected === operation.operationId && styles.selected)}
                    onClick={() => setSelected(operation.operationId)}
                  >
                    <span className={cx(styles.method, styles[method])}>{method}</span>
                    <code>{path}</code>
                  </button>
                ))}
            </section>
          ))}
        </nav>
        <section className={styles.detail} aria-live="polite">
          {current ? (
            <>
              <h2>
                <span className={cx(styles.method, styles[current.method])}>{current.method}</span>{' '}
                <code>{current.path}</code>
              </h2>
              <p>{current.operation.summary}</p>
              <p className={styles.meta}>operationId: {current.operation.operationId}</p>
              {current.operation.parameters.length ? (
                <>
                  <h3>Parameters</h3>
                  <ul className={styles.params}>
                    {current.operation.parameters.map((parameter) => (
                      <li key={`${parameter.in}-${parameter.name}`}>
                        <code>{parameter.name}</code> <span>{parameter.in}</span>
                        {parameter.required ? <b>required</b> : null} {parameter.description}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {current.operation.requestBody ? (
                <>
                  <h3>Request body</h3>
                  <pre>
                    {JSON.stringify(Object.values(current.operation.requestBody.content)[0]?.schema, null, 2)}
                  </pre>
                </>
              ) : null}
              {Object.entries(current.operation.responses).map(([status, response]) => (
                <div key={status}>
                  <h3>
                    {status === 'default' ? 'Error' : status} — {response.description}
                  </h3>
                  {response.content ? (
                    <pre>{JSON.stringify(Object.values(response.content)[0]?.schema, null, 2)}</pre>
                  ) : null}
                </div>
              ))}
              <p className={styles.meta}>
                Named schemas are under <code>components.schemas</code> in the downloaded file.
              </p>
            </>
          ) : (
            <p className={styles.meta}>Select an operation to see its parameters and schemas.</p>
          )}
        </section>
      </div>
    </div>
  );
}
