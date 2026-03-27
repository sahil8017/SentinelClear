"""PDF statement generator — produces bank-grade account statements.

Uses ReportLab to generate professional PDF statements with:
  - Account holder details and date range
  - Transaction table with running balance
  - Summary totals (opening balance, credits, debits, closing balance)
  - Ledger integrity hash for tamper verification
"""

import io
from datetime import datetime, timedelta
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    HRFlowable,
)


def generate_statement_pdf(
    account_id: str,
    account_type: str,
    owner_name: str,
    owner_email: str,
    opening_balance: float,
    closing_balance: float,
    ledger_entries: list[dict],
    start_date: datetime,
    end_date: datetime,
    audit_hash: Optional[str] = None,
) -> bytes:
    """Generate a PDF account statement.

    Args:
        account_id: Account UUID
        account_type: savings/checking
        owner_name: Account holder name
        owner_email: Account holder email
        opening_balance: Balance at start of period
        closing_balance: Current balance
        ledger_entries: List of {date, description, entry_type, amount, balance_after}
        start_date: Statement period start
        end_date: Statement period end
        audit_hash: Latest audit chain hash for verification

    Returns:
        PDF file content as bytes
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    elements = []

    # ── Custom styles ─────────────────────────────────────────
    title_style = ParagraphStyle(
        "StatementTitle",
        parent=styles["Heading1"],
        fontSize=18,
        spaceAfter=4 * mm,
        textColor=colors.HexColor("#1a1a2e"),
    )
    subtitle_style = ParagraphStyle(
        "StatementSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#666666"),
        spaceAfter=2 * mm,
    )
    info_style = ParagraphStyle(
        "InfoStyle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#333333"),
        spaceAfter=1 * mm,
    )
    footer_style = ParagraphStyle(
        "FooterStyle",
        parent=styles["Normal"],
        fontSize=7,
        textColor=colors.HexColor("#999999"),
        spaceAfter=1 * mm,
    )

    # ── Header ────────────────────────────────────────────────
    elements.append(Paragraph("🛡️ SentinelClear", title_style))
    elements.append(Paragraph("Account Statement", subtitle_style))
    elements.append(HRFlowable(
        width="100%", thickness=1,
        color=colors.HexColor("#1a1a2e"), spaceAfter=4 * mm,
    ))

    # ── Account details ───────────────────────────────────────
    elements.append(Paragraph(f"<b>Account Holder:</b> {owner_name}", info_style))
    elements.append(Paragraph(f"<b>Email:</b> {owner_email}", info_style))
    elements.append(Paragraph(f"<b>Account ID:</b> {account_id}", info_style))
    elements.append(Paragraph(f"<b>Account Type:</b> {account_type.capitalize()}", info_style))
    elements.append(Paragraph(
        f"<b>Statement Period:</b> {start_date.strftime('%d %b %Y')} — {end_date.strftime('%d %b %Y')}",
        info_style,
    ))
    elements.append(Paragraph(
        f"<b>Generated:</b> {datetime.utcnow().strftime('%d %b %Y, %H:%M UTC')}",
        info_style,
    ))
    elements.append(Spacer(1, 4 * mm))

    # ── Summary box ───────────────────────────────────────────
    total_credits = sum(e["amount"] for e in ledger_entries if e["entry_type"] == "CREDIT")
    total_debits = sum(e["amount"] for e in ledger_entries if e["entry_type"] == "DEBIT")

    summary_data = [
        ["Opening Balance", "Total Credits", "Total Debits", "Closing Balance"],
        [
            f"₹{opening_balance:,.2f}",
            f"₹{total_credits:,.2f}",
            f"₹{total_debits:,.2f}",
            f"₹{closing_balance:,.2f}",
        ],
    ]
    summary_table = Table(summary_data, colWidths=[42 * mm] * 4)
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("FONTSIZE", (0, 1), (-1, 1), 10),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("TOPPADDING", (0, 0), (-1, -1), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3 * mm),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 6 * mm))

    # ── Transaction table ─────────────────────────────────────
    elements.append(Paragraph("<b>Transaction Details</b>", info_style))
    elements.append(Spacer(1, 2 * mm))

    table_header = ["Date", "Transfer ID", "Type", "Amount (₹)", "Balance (₹)"]
    table_data = [table_header]

    for entry in ledger_entries:
        entry_date = entry["date"].strftime("%d %b %Y, %H:%M") if isinstance(entry["date"], datetime) else str(entry["date"])
        transfer_short = entry.get("transfer_id", "—")[:12] + "..."
        entry_type = entry["entry_type"]
        amount_str = f"₹{entry['amount']:,.2f}"
        if entry_type == "DEBIT":
            amount_str = f"-{amount_str}"
        else:
            amount_str = f"+{amount_str}"
        balance_str = f"₹{entry['balance_after']:,.2f}"

        table_data.append([entry_date, transfer_short, entry_type, amount_str, balance_str])

    if len(table_data) == 1:
        table_data.append(["—", "No transactions in this period", "—", "—", "—"])

    col_widths = [35 * mm, 35 * mm, 20 * mm, 35 * mm, 35 * mm]
    txn_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    # Alternate row shading
    row_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (2, 0), (-1, -1), "CENTER"),
        ("ALIGN", (3, 1), (4, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddddd")),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
    ]
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            row_styles.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f5f5f5")))

    txn_table.setStyle(TableStyle(row_styles))
    elements.append(txn_table)
    elements.append(Spacer(1, 6 * mm))

    # ── Footer ────────────────────────────────────────────────
    elements.append(HRFlowable(
        width="100%", thickness=0.5,
        color=colors.HexColor("#cccccc"), spaceAfter=2 * mm,
    ))
    elements.append(Paragraph(
        f"Total Transactions: {len(ledger_entries)} | "
        f"Credits: {sum(1 for e in ledger_entries if e['entry_type'] == 'CREDIT')} | "
        f"Debits: {sum(1 for e in ledger_entries if e['entry_type'] == 'DEBIT')}",
        footer_style,
    ))
    if audit_hash:
        elements.append(Paragraph(
            f"Audit Chain Hash: {audit_hash}",
            footer_style,
        ))
    elements.append(Paragraph(
        "This is a system-generated statement from SentinelClear. "
        "Ledger integrity is verified by SHA-256 hash chain.",
        footer_style,
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
