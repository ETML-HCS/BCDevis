from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


BASE_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = Path.home() / "Downloads" / "Devis_DEV-000068_final.pdf"

QUOTE = {
    "number": "DEV-000068",
    "date": "17 juillet 2026",
    "valid_until": "16 août 2026",
    "client": "Kateryna Pursheva",
    "phone": "+41 76 430 93 19",
    "email": "purshevakateryna1@gmail.com",
    "items": [
        {
            "name": "Aisselles",
            "description": "Épilation laser - zone des aisselles",
            "quantity": 7,
            "unit_price": 122.00,
        },
        {
            "name": "Bras complets",
            "description": "Épilation laser - bras dans leur intégralité",
            "quantity": 7,
            "unit_price": 322.00,
        },
        {
            "name": "Barbe",
            "description": "Épilation laser - zone du visage",
            "quantity": 7,
            "unit_price": 222.00,
        },
    ],
    "discount_percent": 50.0,
    "student_offer_active": False,
    "installment_active": True,
}

INK = HexColor("#17343B")
MUTED = HexColor("#66767B")
ACCENT = HexColor("#B88A56")
ACCENT_SOFT = HexColor("#F3ECE3")
LINE = HexColor("#DCE5E4")
PANEL = HexColor("#F4F7F6")
SUCCESS = HexColor("#296C5D")
WHITE = HexColor("#FFFFFF")
RED = HexColor("#A45043")


def register_fonts():
    regular = Path("C:/Windows/Fonts/arial.ttf")
    bold = Path("C:/Windows/Fonts/arialbd.ttf")
    serif = Path("C:/Windows/Fonts/georgia.ttf")
    serif_bold = Path("C:/Windows/Fonts/georgiab.ttf")
    if all(path.exists() for path in (regular, bold, serif, serif_bold)):
        pdfmetrics.registerFont(TTFont("BellecourSans", str(regular)))
        pdfmetrics.registerFont(TTFont("BellecourSans-Bold", str(bold)))
        pdfmetrics.registerFont(TTFont("BellecourSerif", str(serif)))
        pdfmetrics.registerFont(TTFont("BellecourSerif-Bold", str(serif_bold)))
        return
    raise FileNotFoundError("Les polices Windows requises sont introuvables.")


def money(value):
    return f"CHF {value:,.2f}".replace(",", "'")


def installment_months(total):
    if total >= 2000:
        return [3, 4, 6, 10, 12]
    if total >= 1000:
        return [3, 4, 6, 10]
    return [3, 4, 6]


def rounded_rect(c, x, y, width, height, radius=3 * mm, fill=PANEL, stroke=LINE):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, width, height, radius, fill=1, stroke=1)


def draw_paragraph(c, text, x, y_top, width, height, style):
    paragraph = Paragraph(text, style)
    _, required_height = paragraph.wrap(width, height)
    paragraph.drawOn(c, x, y_top - required_height)
    return required_height


def build_pdf(output_path):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    register_fonts()
    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4
    left = 38
    right = width - 38
    content_width = right - left

    subtotal = sum(item["quantity"] * item["unit_price"] for item in QUOTE["items"])
    discount = subtotal * QUOTE["discount_percent"] / 100
    total = subtotal - discount

    c.setTitle(f"Devis {QUOTE['number']} - Clinique Bellecour")
    c.setAuthor("Clinique Bellecour")
    c.setSubject("Devis de prestations de médecine esthétique")

    c.setFillColor(INK)
    c.rect(0, height - 12, width * 0.72, 12, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(width * 0.72, height - 12, width * 0.28, 12, fill=1, stroke=0)

    # Header and brand
    monogram_x = left
    monogram_y = height - 77
    c.setFillColor(INK)
    c.roundRect(monogram_x, monogram_y, 38, 38, 10, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("BellecourSerif-Bold", 21)
    c.drawCentredString(monogram_x + 19, monogram_y + 10.5, "B")

    c.setFillColor(ACCENT)
    c.setFont("BellecourSans-Bold", 6.7)
    c.drawString(left + 49, height - 47, "MÉDECINE ESTHÉTIQUE")
    c.setFillColor(INK)
    c.setFont("BellecourSerif-Bold", 17.5)
    c.drawString(left + 49, height - 66, "Clinique Bellecour")

    c.setFillColor(MUTED)
    c.setFont("BellecourSans", 7.5)
    company_lines = [
        "Rue du Mont-Blanc 20 · Genève",
        "+41 78 669 63 44 · contact@cliniquebellecour.ch",
        "UID : CHE-244.490.739",
    ]
    for index, line in enumerate(company_lines):
        c.drawString(left + 49, height - 82 - index * 10, line)

    c.setFillColor(INK)
    c.setFont("BellecourSerif-Bold", 25)
    c.drawRightString(right, height - 55, "Devis")
    c.setFont("BellecourSans-Bold", 10.5)
    c.drawRightString(right, height - 73, QUOTE["number"])
    c.setFillColor(MUTED)
    c.setFont("BellecourSans", 7.6)
    c.drawRightString(right, height - 87, f"Émis le {QUOTE['date']}")

    c.setStrokeColor(LINE)
    c.setLineWidth(0.8)
    c.line(left, height - 112, right, height - 112)

    # Client and reference cards
    overview_y = height - 190
    card_h = 59
    gap = 12
    client_w = 316
    ref_w = content_width - client_w - gap
    rounded_rect(c, left, overview_y, client_w, card_h)
    rounded_rect(c, left + client_w + gap, overview_y, ref_w, card_h)

    c.setFillColor(ACCENT)
    c.setFont("BellecourSans-Bold", 6.5)
    c.drawString(left + 13, overview_y + 43, "CLIENT")
    c.setFillColor(INK)
    c.setFont("BellecourSans-Bold", 12)
    c.drawString(left + 13, overview_y + 27, QUOTE["client"])
    c.setFillColor(MUTED)
    c.setFont("BellecourSans", 7.7)
    c.drawString(
        left + 13,
        overview_y + 12,
        f"{QUOTE['phone']} · {QUOTE['email']}",
    )

    ref_x = left + client_w + gap
    c.setFillColor(ACCENT)
    c.setFont("BellecourSans-Bold", 6.5)
    c.drawString(ref_x + 13, overview_y + 43, "RÉFÉRENCES")
    labels = ["Date du devis", "Valable jusqu'au", "Devise"]
    values = ["17.07.2026", "16.08.2026", "CHF"]
    for index, (label, value) in enumerate(zip(labels, values)):
        line_y = overview_y + 28 - index * 10
        c.setFillColor(MUTED)
        c.setFont("BellecourSans", 7.2)
        c.drawString(ref_x + 13, line_y, label)
        c.setFillColor(INK)
        c.setFont("BellecourSans-Bold", 7.2)
        c.drawRightString(ref_x + ref_w - 13, line_y, value)

    # Services table
    section_y = overview_y - 25
    c.setFillColor(INK)
    c.setFont("BellecourSans-Bold", 7.4)
    c.drawString(left, section_y, "PRESTATIONS SÉLECTIONNÉES")

    table_top = section_y - 11
    header_h = 25
    row_h = 41
    columns = [left, left + 236, left + 298, left + 402, right]
    c.setFillColor(INK)
    c.roundRect(left, table_top - header_h, content_width, header_h, 7, fill=1, stroke=0)
    c.rect(left, table_top - header_h, content_width, 7, fill=1, stroke=0)
    headers = [
        ("ZONE ET PRESTATION", columns[0] + 12, TA_LEFT),
        ("QTÉ", (columns[1] + columns[2]) / 2, TA_CENTER),
        ("PRIX / SÉANCE", columns[3] - 10, TA_RIGHT),
        ("TOTAL", columns[4] - 10, TA_RIGHT),
    ]
    c.setFillColor(WHITE)
    c.setFont("BellecourSans-Bold", 6.5)
    for label, x, alignment in headers:
        if alignment == TA_CENTER:
            c.drawCentredString(x, table_top - 16, label)
        elif alignment == TA_RIGHT:
            c.drawRightString(x, table_top - 16, label)
        else:
            c.drawString(x, table_top - 16, label)

    row_top = table_top - header_h
    for index, item in enumerate(QUOTE["items"]):
        row_y = row_top - (index + 1) * row_h
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(left, row_y, right, row_y)
        c.setFillColor(INK)
        c.setFont("BellecourSans-Bold", 9)
        c.drawString(left + 12, row_y + 23, item["name"])
        c.setFillColor(MUTED)
        c.setFont("BellecourSans", 6.7)
        c.drawString(left + 12, row_y + 11, item["description"])
        c.setFillColor(INK)
        c.setFont("BellecourSans", 8.4)
        c.drawCentredString(
            (columns[1] + columns[2]) / 2,
            row_y + 17,
            str(item["quantity"]),
        )
        c.drawRightString(
            columns[3] - 10,
            row_y + 17,
            money(item["unit_price"]),
        )
        c.setFont("BellecourSans-Bold", 8.4)
        c.drawRightString(
            columns[4] - 10,
            row_y + 17,
            money(item["quantity"] * item["unit_price"]),
        )

    # Offer note and totals
    summary_top = row_top - len(QUOTE["items"]) * row_h - 12
    note_w = 262
    note_h = 58
    c.setFillColor(ACCENT_SOFT)
    c.roundRect(left, summary_top - note_h, note_w, note_h, 7, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.roundRect(left, summary_top - note_h, 4, note_h, 2, fill=1, stroke=0)
    c.setFillColor(INK)
    c.setFont("BellecourSans-Bold", 8.2)
    c.drawString(left + 14, summary_top - 18, "Votre offre personnalisée")
    note_style = ParagraphStyle(
        "note",
        fontName="BellecourSans",
        fontSize=7.2,
        leading=9.2,
        textColor=HexColor("#67533D"),
    )
    draw_paragraph(
        c,
        "Une remise commerciale de 50 % est appliquée à l'ensemble des prestations listées ci-dessus.",
        left + 14,
        summary_top - 26,
        note_w - 27,
        28,
        note_style,
    )

    totals_x = left + note_w + 24
    totals_right = right
    totals_lines = [
        ("Sous-total", money(subtotal), MUTED, INK, "BellecourSans", 8),
        (
            "Remise (50 %)",
            f"- {money(discount)}",
            RED,
            RED,
            "BellecourSans",
            8,
        ),
    ]
    for index, (label, value, label_color, value_color, font, size) in enumerate(
        totals_lines
    ):
        y = summary_top - 14 - index * 17
        c.setFillColor(label_color)
        c.setFont(font, size)
        c.drawString(totals_x, y, label)
        c.setFillColor(value_color)
        c.setFont("BellecourSans-Bold", size)
        c.drawRightString(totals_right, y, value)
    c.setStrokeColor(INK)
    c.setLineWidth(1)
    c.line(totals_x, summary_top - 45, totals_right, summary_top - 45)
    c.setFillColor(INK)
    c.setFont("BellecourSans-Bold", 11.5)
    c.drawString(totals_x, summary_top - 60, "Total")
    c.drawRightString(totals_right, summary_top - 60, money(total))

    # Installments
    installment_top = summary_top - 84
    if QUOTE["installment_active"]:
        c.setFillColor(INK)
        c.setFont("BellecourSans-Bold", 7.4)
        c.drawString(left, installment_top, "OPTIONS DE PAIEMENT ÉCHELONNÉ")
        c.setFillColor(MUTED)
        c.setFont("BellecourSans", 6.5)
        c.drawRightString(
            right, installment_top, "Montants indicatifs, arrondis à 2 décimales"
        )
        months = installment_months(total)
        card_gap = 7
        card_w = (content_width - card_gap * (len(months) - 1)) / len(months)
        card_h = 47
        card_y = installment_top - 57
        for index, month_count in enumerate(months):
            x = left + index * (card_w + card_gap)
            rounded_rect(c, x, card_y, card_w, card_h, radius=6)
            c.setFillColor(SUCCESS)
            c.setFont("BellecourSans-Bold", 7)
            c.drawCentredString(x + card_w / 2, card_y + 31, f"{month_count} MOIS")
            c.setFillColor(INK)
            c.setFont("BellecourSans-Bold", 8.3)
            c.drawCentredString(
                x + card_w / 2,
                card_y + 18,
                money(total / month_count),
            )
            c.setFillColor(MUTED)
            c.setFont("BellecourSans", 5.8)
            c.drawCentredString(x + card_w / 2, card_y + 8, "par mois")
        content_top = card_y - 22
    else:
        content_top = installment_top

    # Optional student block (not active for this quote)
    if QUOTE["student_offer_active"]:
        student_h = 78
        rounded_rect(
            c,
            left,
            content_top - student_h,
            content_width,
            student_h,
            radius=7,
            fill=HexColor("#FBF7F0"),
            stroke=HexColor("#D6C09F"),
        )
        c.setFillColor(HexColor("#745532"))
        c.setFont("BellecourSerif-Bold", 11)
        c.drawString(left + 13, content_top - 19, "Offre spéciale étudiants")
        student_style = ParagraphStyle(
            "student",
            fontName="BellecourSans",
            fontSize=6.6,
            leading=8.2,
            textColor=HexColor("#745532"),
        )
        student_text = (
            "Pack de 6 séances à -50 % · Happy Hours du lundi au vendredi, 10h-12h "
            "et 14h-16h30 · Réservation en ligne obligatoire · Paiement mensuel par "
            "facture pour les résidents suisses · Commentaire Google requis · Offre "
            "réservée aux étudiants et non cumulable · Rue du Mont-Blanc 20, Genève."
        )
        draw_paragraph(
            c,
            student_text,
            left + 13,
            content_top - 29,
            content_width - 26,
            44,
            student_style,
        )
        content_top -= student_h + 16

    # Conditions and remarks
    conditions_h = 102
    conditions_y = content_top - conditions_h
    conditions_gap = 12
    conditions_w = 315
    remarks_w = content_width - conditions_w - conditions_gap
    rounded_rect(
        c,
        left,
        conditions_y,
        conditions_w,
        conditions_h,
        radius=7,
        fill=WHITE,
        stroke=LINE,
    )
    rounded_rect(
        c,
        left + conditions_w + conditions_gap,
        conditions_y,
        remarks_w,
        conditions_h,
        radius=7,
        fill=WHITE,
        stroke=LINE,
    )
    c.setFillColor(INK)
    c.setFont("BellecourSans-Bold", 7.4)
    c.drawString(left + 12, content_top - 18, "CONDITIONS DE PAIEMENT")
    c.drawString(
        left + conditions_w + conditions_gap + 12,
        content_top - 18,
        "REMARQUES",
    )

    condition_style = ParagraphStyle(
        "condition",
        fontName="BellecourSans",
        fontSize=6.8,
        leading=8.8,
        textColor=MUTED,
        alignment=TA_LEFT,
    )
    condition_text = (
        "Le règlement peut s'effectuer à chaque séance ou par l'achat d'un pack. "
        "Les paiements sont acceptés par carte, en espèces, via TWINT, par virement "
        "bancaire ou par paiement échelonné.<br/><br/>"
        "L'échelonnement est soumis à l'accord du partenaire financier : résidence "
        "en Suisse depuis au moins un an, permis B ou C ou nationalité suisse, pièce "
        "d'identité valide et contrôle de solvabilité."
    )
    draw_paragraph(
        c,
        condition_text,
        left + 12,
        content_top - 29,
        conditions_w - 24,
        65,
        condition_style,
    )

    remarks_text = (
        "Prix exprimés en francs suisses. Les mensualités correspondent au total "
        "du devis divisé par la durée choisie ; les éventuels frais du partenaire "
        "ne sont pas inclus.<br/><br/>"
        f"Ce devis reste valable jusqu'au {QUOTE['valid_until']}."
    )
    draw_paragraph(
        c,
        remarks_text,
        left + conditions_w + conditions_gap + 12,
        content_top - 29,
        remarks_w - 24,
        65,
        condition_style,
    )

    # Acceptance
    signature_y = conditions_y - 39
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.line(left, signature_y + 18, left + 215, signature_y + 18)
    c.line(left + 245, signature_y + 18, right, signature_y + 18)
    c.setFillColor(MUTED)
    c.setFont("BellecourSans", 6.5)
    c.drawString(left, signature_y + 8, "Date et lieu")
    c.drawString(left + 245, signature_y + 8, "Signature du client · Bon pour accord")

    # Footer
    footer_y = 27
    c.setStrokeColor(LINE)
    c.line(left, footer_y + 13, right, footer_y + 13)
    c.setFillColor(MUTED)
    c.setFont("BellecourSans", 6.3)
    c.drawString(left, footer_y, f"Clinique Bellecour · {QUOTE['number']}")
    c.drawRightString(right, footer_y, "Page 1 / 1")

    c.showPage()
    c.save()


if __name__ == "__main__":
    build_pdf(OUTPUT_PATH)
    print(OUTPUT_PATH)
