{{-- Shared "world-class" visual language for every generated PDF: invoices,
     account statements, and every report export. One stylesheet so every
     document in the app looks like it belongs to the same professional
     letterhead system. --}}
<style>
    * { font-family: sans-serif; }
    body { color: #1f2937; font-size: 11px; }

    /* Letterhead */
    .ribbon { height: 4px; background-color: #b8901f; background-image: linear-gradient(90deg, #b8901f 0%, #e3bc45 50%, #b8901f 100%); border-radius: 3px 3px 0 0; }
    .brandbar {
        background-color: #1e6f5c;
        background-image: linear-gradient(135deg, #0f4a3b 0%, #1e6f5c 55%, #2e8f75 100%);
        color: #ffffff; padding: 16px 20px; border-radius: 0 0 8px 8px;
    }
    .brand-name { font-size: 22px; font-weight: bold; letter-spacing: 0.3px; }
    .brand-meta { font-size: 10px; color: #d7ece5; margin-top: 4px; line-height: 1.6; }
    .brand-rule { height: 2px; width: 46px; background: #e3bc45; margin-top: 8px; border-radius: 1px; }

    {{-- Two-column header row (party box + status pill / balance box). Built
         with floats rather than a table, because mpdf renders a bordered
         block's border per text-line instead of as one box when that block
         sits inside a <td> — floats sidestep the bug entirely. --}}
    .doc-head { width: 100%; margin-top: 18px; }
    .doc-head:after { content: ""; display: block; clear: both; }
    .doc-head .col-main { float: left; width: 58%; box-sizing: border-box; padding-right: 12px; }
    .doc-head .col-side { float: right; width: 40%; box-sizing: border-box; }
    .doc-title { font-size: 18px; font-weight: bold; color: #10493c; margin: 0; padding-left: 10px; border-left: 4px solid #e3bc45; }
    .doc-sub { font-size: 10px; color: #6b7280; margin-top: 5px; padding-left: 10px; }

    /* Reference / meta boxes */
    .box {
        border: 1px solid #e2e8e5; border-top: 3px solid #1e6f5c; border-radius: 6px;
        padding: 11px 13px; background: #f8faf9;
    }
    .label { font-size: 8.5px; color: #7c8b86; text-transform: uppercase; letter-spacing: 0.6px; font-weight: bold; }
    .party-name { font-size: 13px; font-weight: bold; color: #111827; margin-top: 1px; }
    .party-line { font-size: 10px; color: #4b5563; margin-top: 2px; }

    .status-pill {
        display: inline-block; color: #fff; font-size: 9.5px; font-weight: bold;
        letter-spacing: 0.4px; text-transform: uppercase; padding: 4px 12px; border-radius: 11px;
    }

    /* Data tables — invoices, ledgers, and every list report share this look */
    table.data, table.items, table.ledger {
        width: 100%; border-collapse: collapse; margin-top: 16px;
    }
    table.data thead th, table.items thead th, table.ledger thead th {
        background-color: #10493c;
        background-image: linear-gradient(90deg, #0f4a3b 0%, #1e6f5c 100%);
        color: #ffffff; font-size: 9.5px; font-weight: bold; text-transform: uppercase;
        letter-spacing: 0.3px; padding: 8px 9px; text-align: left;
    }
    table.data thead th.num, table.items thead th.num, table.ledger thead th.num { text-align: right; }
    table.data tbody td, table.items tbody td, table.ledger tbody td {
        padding: 7px 9px; border-bottom: 1px solid #e9edeb; font-size: 10px;
    }
    table.data tbody tr:nth-child(even) td, table.items tbody tr:nth-child(even) td, table.ledger tbody tr:nth-child(even) td {
        background: #f8faf9;
    }
    td.num { text-align: right; }
    .muted { color: #6b7280; }
    .credit { color: #1e6f5c; }
    .debit { color: #b3261e; }
    .returned-tag { color: #b3261e; font-size: 9px; }
    .empty { color: #9ca3af; padding: 18px; text-align: center; font-style: italic; }

    tr.subtotal td, tr.totals td {
        font-weight: bold; background: #f1f8f4 !important; border-top: 1px solid #cfe0d9; color: #10493c;
    }

    /* Totals card — the running summary at the foot of an invoice/statement */
    table.totals { width: 48%; border-collapse: collapse; margin-top: 14px; float: right; }
    table.totals td { padding: 5px 9px; font-size: 11px; }
    table.totals tr.grand td, table.totals tr.net td {
        border-top: 2px solid #10493c; font-weight: bold; font-size: 13.5px; color: #10493c; padding-top: 8px;
    }

    .summary-box {
        border: 1px solid #cfe0d9; border-top: 3px solid #e3bc45; border-radius: 6px;
        padding: 12px 16px; background: #f2f8f5; margin-top: 12px;
    }
    .summary-row { font-size: 15px; font-weight: bold; color: #10493c; }

    .balance-box { border-radius: 6px; padding: 11px 13px; text-align: center; color: #ffffff; }
    .balance-amt { font-size: 19px; font-weight: bold; }
    .balance-cap { font-size: 9px; opacity: 0.92; text-transform: uppercase; letter-spacing: 0.4px; }

    .section-title {
        font-size: 12px; font-weight: bold; color: #10493c; margin: 20px 0 6px;
        padding-left: 8px; border-left: 3px solid #e3bc45;
    }
</style>
