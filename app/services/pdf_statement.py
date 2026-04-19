"""PDF statement generator — produces bank-grade account statements.

Uses ReportLab to generate professional PDF statements with:
  - Clean, modern two-column header layout
  - Account holder details and date range
  - Summary totals (opening balance, credits, debits, closing balance)
  - Transaction table with running balance and alternating rows
  - Ledger integrity hash for tamper verification

NOTE: Uses 'INR' text prefix instead of ₹ glyph to guarantee rendering
across all PDF viewers without requiring embedded Unicode fonts.
"""

import io
from datetime import datetime, timezone
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    HRFlowable,
)

# ── Brand Colours ────────────────────────────────────────────
NAVY      = colors.HexColor("#0F172A")
SLATE     = colors.HexColor("#334155")
MUTED     = colors.HexColor("#64748B")
LIGHT_BG  = colors.HexColor("#F8FAFC")
ROW_ALT   = colors.HexColor("#F1F5F9")
BORDER    = colors.HexColor("#E2E8F0")
WHITE     = colors.white
GREEN     = colors.HexColor("#16A34A")
RED       = colors.HexColor("#DC2626")
ACCENT    = colors.HexColor("#2563EB")


def _fmt(amount: float) -> str:
    """Format amount with INR prefix — avoids Unicode glyph rendering issues."""
    return f"INR {amount:,.2f}"


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

    Returns PDF file content as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
    )

    elements = []

    # ── Paragraph Styles ─────────────────────────────────────
    s_brand = ParagraphStyle(
        "Brand", fontName="Helvetica-Bold", fontSize=20,
        textColor=NAVY, spaceAfter=1 * mm,
    )
    s_tagline = ParagraphStyle(
        "Tagline", fontName="Helvetica", fontSize=9,
        textColor=MUTED, spaceAfter=0,
    )
    s_label = ParagraphStyle(
        "Label", fontName="Helvetica", fontSize=8,
        textColor=MUTED, spaceAfter=0, leading=12,
    )
    s_value = ParagraphStyle(
        "Value", fontName="Helvetica-Bold", fontSize=9,
        textColor=SLATE, spaceAfter=0, leading=13,
    )
    s_section = ParagraphStyle(
        "Section", fontName="Helvetica-Bold", fontSize=11,
        textColor=NAVY, spaceBefore=4 * mm, spaceAfter=2 * mm,
    )
    s_footer = ParagraphStyle(
        "Footer", fontName="Helvetica", fontSize=7,
        textColor=MUTED, spaceAfter=1 * mm, alignment=TA_LEFT,
    )
    s_footer_center = ParagraphStyle(
        "FooterCenter", fontName="Helvetica", fontSize=7,
        textColor=MUTED, spaceAfter=0, alignment=TA_CENTER,
    )

    # ══════════════════════════════════════════════════════════
    # HEADER — Two-column: Brand left, Account info right
    # ══════════════════════════════════════════════════════════

    left_header = [
        [Paragraph("SENTINELCLEAR", s_brand)],
        [Paragraph("Account Statement", s_tagline)],
    ]
    left_table = Table(left_header, colWidths=[90 * mm])
    left_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    s_right_label = ParagraphStyle(
        "RLabel", fontName="Helvetica", fontSize=7,
        textColor=MUTED, alignment=TA_RIGHT, leading=10,
    )
    s_right_value = ParagraphStyle(
        "RValue", fontName="Helvetica-Bold", fontSize=8,
        textColor=SLATE, alignment=TA_RIGHT, leading=11,
    )

    right_header = [
        [Paragraph("STATEMENT DATE", s_right_label)],
        [Paragraph(datetime.now(timezone.utc).strftime("%d %b %Y"), s_right_value)],
        [Spacer(1, 2 * mm)],
        [Paragraph("PERIOD", s_right_label)],
        [Paragraph(f"{start_date.strftime('%d %b %Y')}  -  {end_date.strftime('%d %b %Y')}", s_right_value)],
    ]
    right_table = Table(right_header, colWidths=[80 * mm])
    right_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))

    header_table = Table([[left_table, right_table]], colWidths=[95 * mm, 85 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 2 * mm))
    elements.append(HRFlowable(
        width="100%", thickness=1.5,
        color=NAVY, spaceAfter=4 * mm,
    ))

    # ══════════════════════════════════════════════════════════
    # ACCOUNT DETAILS — Clean two-column grid
    # ══════════════════════════════════════════════════════════

    details_data = [
        [
            Paragraph("ACCOUNT HOLDER", s_label),
            Paragraph("EMAIL", s_label),
        ],
        [
            Paragraph(owner_name, s_value),
            Paragraph(owner_email, s_value),
        ],
        [Spacer(1, 2 * mm), Spacer(1, 2 * mm)],
        [
            Paragraph("ACCOUNT ID", s_label),
            Paragraph("ACCOUNT TYPE", s_label),
        ],
        [
            Paragraph(account_id, s_value),
            Paragraph(account_type.upper(), s_value),
        ],
    ]
    details_table = Table(details_data, colWidths=[95 * mm, 85 * mm])
    details_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    elements.append(details_table)
    elements.append(Spacer(1, 5 * mm))

    # ══════════════════════════════════════════════════════════
    # SUMMARY CARDS — Four equal boxes
    # ══════════════════════════════════════════════════════════

    total_credits = sum(e["amount"] for e in ledger_entries if e["entry_type"] == "CREDIT")
    total_debits = sum(e["amount"] for e in ledger_entries if e["entry_type"] == "DEBIT")

    s_card_label = ParagraphStyle(
        "CardLabel", fontName="Helvetica", fontSize=7,
        textColor=WHITE, alignment=TA_CENTER, leading=10,
    )
    s_card_value = ParagraphStyle(
        "CardValue", fontName="Helvetica-Bold", fontSize=11,
        textColor=WHITE, alignment=TA_CENTER, leading=14,
    )

    card_w = 43 * mm
    cards = [
        ("Opening Balance", _fmt(opening_balance)),
        ("Total Credits", _fmt(total_credits)),
        ("Total Debits", _fmt(total_debits)),
        ("Closing Balance", _fmt(closing_balance)),
    ]

    card_labels = [Paragraph(c[0], s_card_label) for c in cards]
    card_values = [Paragraph(c[1], s_card_value) for c in cards]

    summary_table = Table(
        [card_labels, card_values],
        colWidths=[card_w] * 4,
    )
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), 3 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 1 * mm),
        ("TOPPADDING", (0, 1), (-1, 1), 1 * mm),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 3 * mm),
        ("LINEAFTER", (0, 0), (2, -1), 0.5, colors.HexColor("#1E293B")),
        ("BOX", (0, 0), (-1, -1), 0.5, NAVY),
        # Rounded effect via padding
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 6 * mm))

    # ══════════════════════════════════════════════════════════
    # TRANSACTION TABLE
    # ══════════════════════════════════════════════════════════

    elements.append(Paragraph("Transaction Details", s_section))

    table_header = ["Date", "Transfer ID", "Type", "Amount", "Balance"]
    table_data = [table_header]

    for entry in ledger_entries:
        entry_date = (
            entry["date"].strftime("%d %b %Y, %H:%M")
            if isinstance(entry["date"], datetime)
            else str(entry["date"])
        )
        transfer_short = entry.get("transfer_id", "-")[:14] + "..."
        entry_type = entry["entry_type"]
        amount_str = _fmt(entry["amount"])
        if entry_type == "DEBIT":
            amount_str = f"- {amount_str}"
        else:
            amount_str = f"+ {amount_str}"
        balance_str = _fmt(entry["balance_after"])

        table_data.append([entry_date, transfer_short, entry_type, amount_str, balance_str])

    if len(table_data) == 1:
        table_data.append(["-", "No transactions in this period", "-", "-", "-"])

    col_widths = [34 * mm, 38 * mm, 18 * mm, 38 * mm, 38 * mm]
    txn_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    row_styles = [
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        # Body rows
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 7.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), SLATE),
        # Alignment
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("ALIGN", (0, 1), (0, -1), "LEFT"),
        ("ALIGN", (1, 1), (1, -1), "LEFT"),
        ("ALIGN", (2, 1), (2, -1), "CENTER"),
        ("ALIGN", (3, 1), (4, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        # Grid
        ("LINEBELOW", (0, 0), (-1, 0), 1, NAVY),
        ("LINEBELOW", (0, 1), (-1, -2), 0.5, BORDER),
        ("LINEBELOW", (0, -1), (-1, -1), 1, BORDER),
        # Padding
        ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
    ]

    # Alternating row shading
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            row_styles.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT))

    txn_table.setStyle(TableStyle(row_styles))
    elements.append(txn_table)
    elements.append(Spacer(1, 8 * mm))

    # ══════════════════════════════════════════════════════════
    # FOOTER
    # ══════════════════════════════════════════════════════════

    elements.append(HRFlowable(
        width="100%", thickness=0.5,
        color=BORDER, spaceAfter=3 * mm,
    ))

    credit_count = sum(1 for e in ledger_entries if e["entry_type"] == "CREDIT")
    debit_count = sum(1 for e in ledger_entries if e["entry_type"] == "DEBIT")

    elements.append(Paragraph(
        f"Total Transactions: {len(ledger_entries)}  |  "
        f"Credits: {credit_count}  |  "
        f"Debits: {debit_count}",
        s_footer,
    ))

    if audit_hash:
        elements.append(Spacer(1, 1 * mm))
        elements.append(Paragraph(
            f"Audit Chain Hash: {audit_hash}",
            s_footer,
        ))

    elements.append(Spacer(1, 3 * mm))
    elements.append(HRFlowable(
        width="100%", thickness=0.3,
        color=BORDER, spaceAfter=2 * mm,
    ))
    elements.append(Paragraph(
        "This is a system-generated statement from SentinelClear. "
        "Ledger integrity is verified by SHA-256 hash chain. "
        "Do not share this document with unauthorized parties.",
        s_footer_center,
    ))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
