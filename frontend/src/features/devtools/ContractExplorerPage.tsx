import styles from '@/app/AppShell.module.css';
import { ContractExplorer } from './ContractExplorer';

export function ContractExplorerPage() {
  return (
    <main className={styles.main}>
      <ContractExplorer />
    </main>
  );
}
