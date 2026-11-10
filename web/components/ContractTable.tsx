import Link from "next/link";
import { documentHref } from "@/constants/documents";
import type { ContractDetails, DateField } from "@/types/api";
import styles from "./ContractTable.module.css";

/** "1 March 2026" for a YYYY-MM-DD date; otherwise the contract's own wording (e.g. a period). */
function formatDate(d: DateField): string | null {
  if (d.value) {
    const date = new Date(`${d.value}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    }
  }
  if (d.as_written) return d.as_written.charAt(0).toUpperCase() + d.as_written.slice(1);
  return null;
}

function formatParties(details: ContractDetails): string | null {
  if (details.parties.length === 0) return null;
  const names = details.parties.map((p) => (p.role ? `${p.name} (${p.role})` : p.name));
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

interface Row {
  detail: string;
  value: string | null;
  pages: number[];
}

function rows(details: ContractDetails): Row[] {
  const pages = (...ps: (number | null)[]) =>
    [...new Set(ps.filter((p): p is number => p !== null))].sort((a, b) => a - b);
  return [
    { detail: "Parties", value: formatParties(details), pages: pages(...details.parties.map((p) => p.page)) },
    { detail: "Start date", value: formatDate(details.start_date), pages: pages(details.start_date.page) },
    { detail: "End date", value: formatDate(details.end_date), pages: pages(details.end_date.page) },
    { detail: "Payment terms", value: details.payment_terms.summary, pages: pages(details.payment_terms.page) },
    { detail: "Renewal clause", value: details.renewal.summary, pages: pages(details.renewal.page) },
  ];
}

/** The Extract page's table view: each key detail with the page it was found on. */
export default function ContractTable({ details }: { details: ContractDetails }) {
  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.colDetail}>Detail</th>
            <th scope="col">Value</th>
            <th scope="col" className={styles.colPage}>Found on</th>
          </tr>
        </thead>
        <tbody>
          {rows(details).map((row) => (
            <tr key={row.detail}>
              <th scope="row" className={styles.colDetail}>{row.detail}</th>
              <td className={row.value ? styles.value : `${styles.value} ${styles.missing}`}>
                {row.value ?? "Not stated"}
              </td>
              <td className={styles.colPage}>
                {row.value && row.pages.length > 0 && (
                  <span className={styles.pages}>
                    {row.pages.map((page) => (
                      <Link
                        key={page}
                        href={documentHref(details.document_id, page)}
                        className={styles.pageTag}
                        aria-label={`${row.detail}: open page ${page} of the contract`}
                      >
                        Page {page}
                      </Link>
                    ))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
