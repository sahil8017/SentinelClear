import io
import json
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from app.models import Transfer

def generate_fiu_str_pdf(transfer: Transfer) -> bytes:
    """
    Generates a Suspicious Transaction Report (STR) PDF payload suitable for FIU reporting.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        rightMargin=40, leftMargin=40,
        topMargin=40, bottomMargin=40
    )

    styles = getSampleStyleSheet()
    title_style = styles['Title']
    heading_style = styles['Heading2']
    normal_style = styles['Normal']
    
    # Custom tight style for list items
    tight_style = ParagraphStyle(
        'Tight',
        parent=styles['Normal'],
        spaceBefore=2,
        spaceAfter=2,
        leading=12
    )

    elements = []

    # Title
    elements.append(Paragraph("SUSPICIOUS TRANSACTION REPORT (STR)", title_style))
    elements.append(Paragraph("CONFIDENTIAL - FINANCIAL INTELLIGENCE UNIT (FIU) FILING", ParagraphStyle(
        'SubTitle', parent=styles['Normal'], textColor=colors.firebrick, alignment=1, spaceAfter=20
    )))

    # Basic Meta
    report_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    tx_time = transfer.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if transfer.created_at else report_time
    
    meta_data = [
        ["Report Generated At:", report_time],
        ["Transaction ID:", transfer.id],
        ["Status:", transfer.status],
        ["Enforcement Action:", "QUARANTINED" if transfer.status in ["FAILED", "PENDING_AUTH"] else "CLEARED"],
    ]

    t_meta = Table(meta_data, colWidths=[2*inch, 4*inch])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.whitesmoke),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
    ]))
    
    elements.append(t_meta)
    elements.append(Spacer(1, 20))

    # Parties Involved
    elements.append(Paragraph("1. Parties Involved", heading_style))
    parties_data = [
        ["Field", "Value"],
        ["Sender Account ID", transfer.sender_account_id],
        ["Receiver Account ID", transfer.receiver_account_id],
        ["Source Geographic Origin", transfer.source_city or "Unknown / Obfuscated"],
        ["Source IP Network", transfer.source_ip or "Unknown"],
    ]
    
    t_parties = Table(parties_data, colWidths=[2*inch, 4*inch])
    t_parties.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
    ]))
    
    elements.append(t_parties)
    elements.append(Spacer(1, 20))

    # Flow of Funds
    elements.append(Paragraph("2. Flow of Funds", heading_style))
    funds_data = [
        ["Metric", "Value"],
        ["Amount (INR)", f"₹ {transfer.amount:,.2f}"],
        ["Attempt Timestamp", tx_time],
    ]
    t_funds = Table(funds_data, colWidths=[2*inch, 4*inch])
    t_funds.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
    ]))
    elements.append(t_funds)
    elements.append(Spacer(1, 20))

    # Threat Intelligence & Risk Matrix
    elements.append(Paragraph("3. SentinelClear Threat Intelligence", heading_style))
    
    risk_score = transfer.risk_score if transfer.risk_score else 0.0
    ml_risk = transfer.ml_risk_score if transfer.ml_risk_score else 0.0
    
    risk_data = [
        ["Indicator", "Value"],
        ["Heuristic Aggregated Risk", f"{risk_score * 100:.2f}% Probability of Illicit Activity"],
        ["Machine Learning Neural Risk", f"{ml_risk * 100:.2f}% Anomaly Confidence"],
    ]
    t_risk = Table(risk_data, colWidths=[2*inch, 4*inch])
    t_risk.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
    ]))
    elements.append(t_risk)
    elements.append(Spacer(1, 10))

    # Explainable AI Rules
    elements.append(Paragraph("Triggered Rules & Explainable AI (XAI) Insight:", ParagraphStyle('Subheading', parent=styles['Normal'], fontName='Helvetica-Bold')))
    
    try:
        rules_list = json.loads(transfer.fraud_rules_triggered) if transfer.fraud_rules_triggered else []
    except Exception:
        rules_list = ["Error parsing heuristics."]

    if not rules_list:
        elements.append(Paragraph("- No specific rules triggered. Baseline anomalies detected.", tight_style))
    else:
        for rule in rules_list:
            if isinstance(rule, dict) and rule.get('source') == 'ML_XAI':
                # Explainable AI block
                xai_text = f"<b>[XAI ALGORITHM INSIGHT]:</b> {rule.get('explanation', 'Unknown anomaly framework')}"
                elements.append(Paragraph(xai_text, ParagraphStyle('XAI', parent=tight_style, textColor=colors.darkred)))
            else:
                rule_text = str(rule)
                elements.append(Paragraph(f"• {rule_text}", tight_style))

    elements.append(Spacer(1, 30))

    # Document signature
    elements.append(Paragraph("This document was automatically synthesized by the SentinelClear OS.", ParagraphStyle(
        'Footer', parent=styles['Normal'], fontSize=8, textColor=colors.gray, alignment=1
    )))
    elements.append(Paragraph("TAMPER-EVIDENT FIU FILING • DO NOT DISTRIBUTE UNSECURED", ParagraphStyle(
        'FooterBold', parent=styles['Normal'], fontSize=8, fontName='Helvetica-Bold', textColor=colors.gray, alignment=1
    )))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
