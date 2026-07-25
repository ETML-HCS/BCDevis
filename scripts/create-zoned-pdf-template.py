#!/usr/bin/env python3
"""Create a numbered-zone review template from the current BCDevis PDF."""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "output" / "pdf" / "BCDevis-test-signatures-ON.pdf"
DEFAULT_OUTPUT = ROOT / "output" / "pdf" / "BCDevis-template-zones-numerotees.pdf"
ASSETS = ROOT / "devis-portable" / "assets"

FONT_REGULAR_FILE = ASSETS / "red-hat-display-regular.ttf"
FONT_SEMI_FILE = ASSETS / "red-hat-display-semibold.ttf"
FONT_EXTRA_FILE = ASSETS / "red-hat-display-extrabold.ttf"
LOGO_FILE = ASSETS / "clinique-bellecour-logo-officiel.png"

FONT_REGULAR = "RHDRegular"
FONT_SEMI = "RHDSemiBold"
FONT_EXTRA = "RHDExtraBold"

ACCENT = (0.58, 0.20, 0.15)
ACCENT_LIGHT = (0.96, 0.91, 0.89)
INK = (0.12, 0.12, 0.12)
MUTED = (0.40, 0.40, 0.40)
RULE = (0.80, 0.78, 0.75)
PAPER = (0.99, 0.985, 0.975)
WHITE = (1.0, 1.0, 1.0)


ZONES = [
    {
        "number": 1,
        "name": "Logo officiel",
        "rect": (37, 29, 279, 88),
        "badge": (37, 16, 78, 29),
    },
    {
        "number": 2,
        "name": "Coordonnées",
        "rect": (390, 29, 559, 89),
        "badge": (390, 16, 431, 29),
    },
    {
        "number": 3,
        "name": "Titre DEVIS et numéro",
        "rect": (37, 113, 559, 154),
        "badge": (37, 100, 78, 113),
    },
    {
        "number": 4,
        "name": "Destinataire",
        "rect": (37, 155, 288, 223),
        "badge": (2, 158, 37, 171),
    },
    {
        "number": 5,
        "name": "Références du devis",
        "rect": (372, 155, 559, 223),
        "badge": (337, 158, 372, 171),
    },
    {
        "number": 6,
        "name": "Tableau des prestations",
        "rect": (37, 228, 559, 340),
        "badge": (2, 231, 37, 244),
    },
    {
        "number": 7,
        "name": "Totaux",
        "rect": (340, 342, 559, 421),
        "badge": (305, 345, 340, 358),
    },
    {
        "number": 8,
        "name": "Modalités de paiement",
        "rect": (37, 426, 559, 514),
        "badge": (2, 429, 37, 442),
    },
    {
        "number": 9,
        "name": "Conditions",
        "rect": (37, 517, 559, 590),
        "badge": (2, 520, 37, 533),
    },
    {
        "number": 10,
        "name": "Zones de signature",
        "rect": (37, 592, 559, 628),
        "badge": (2, 595, 37, 608),
    },
    {
        "number": 11,
        "name": "Pied de page",
        "rect": (37, 633, 559, 665),
        "badge": (2, 636, 37, 649),
    },
]


def insert_fonts(page: fitz.Page) -> None:
    page.insert_font(fontname=FONT_REGULAR, fontfile=str(FONT_REGULAR_FILE))
    page.insert_font(fontname=FONT_SEMI, fontfile=str(FONT_SEMI_FILE))
    page.insert_font(fontname=FONT_EXTRA, fontfile=str(FONT_EXTRA_FILE))


def insert_textbox(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    *,
    fontsize: float,
    fontname: str = FONT_REGULAR,
    color: tuple[float, float, float] = INK,
    align: int = fitz.TEXT_ALIGN_LEFT,
    lineheight: float = 1.15,
) -> None:
    remaining = page.insert_textbox(
        rect,
        text,
        fontsize=fontsize,
        fontname=fontname,
        color=color,
        align=align,
        lineheight=lineheight,
        overlay=True,
    )
    if remaining < 0:
        raise RuntimeError(f"Text does not fit in rectangle {rect}: {text!r}")


def annotate_first_page(page: fitz.Page) -> None:
    insert_fonts(page)

    for zone in ZONES:
        zone_rect = fitz.Rect(zone["rect"])
        badge_rect = fitz.Rect(zone["badge"])

        page.draw_rect(
            zone_rect,
            color=ACCENT,
            fill=ACCENT_LIGHT,
            width=1.15,
            stroke_opacity=0.92,
            fill_opacity=0.055,
            dashes="[4 3] 0",
            overlay=True,
        )
        page.draw_rect(
            badge_rect,
            color=ACCENT,
            fill=ACCENT,
            width=0.6,
            overlay=True,
        )
        insert_textbox(
            page,
            badge_rect + (0, 2.2, 0, 0),
            f"ZONE {zone['number']}",
            fontsize=5.7,
            fontname=FONT_EXTRA,
            color=WHITE,
            align=fitz.TEXT_ALIGN_CENTER,
            lineheight=1,
        )

    note_y = page.rect.height - 42
    page.draw_line(
        fitz.Point(37, note_y),
        fitz.Point(page.rect.width - 37, note_y),
        color=RULE,
        width=0.6,
        overlay=True,
    )
    insert_textbox(
        page,
        fitz.Rect(37, note_y + 9, page.rect.width - 37, note_y + 28),
        "Utilisez le numéro de zone dans vos retours. La légende complète figure en page 2.",
        fontsize=7.5,
        fontname=FONT_SEMI,
        color=MUTED,
        align=fitz.TEXT_ALIGN_CENTER,
    )


def add_review_sheet(doc: fitz.Document, width: float, height: float) -> None:
    page = doc.new_page(width=width, height=height)
    insert_fonts(page)

    page.draw_rect(page.rect, fill=PAPER, color=PAPER, overlay=True)

    logo_rect = fitz.Rect(38, 28, 224, 83)
    page.insert_image(
        logo_rect,
        filename=str(LOGO_FILE),
        keep_proportion=True,
        overlay=True,
    )

    insert_textbox(
        page,
        fitz.Rect(344, 36, width - 38, 57),
        "TEMPLATE DE VALIDATION",
        fontsize=8,
        fontname=FONT_EXTRA,
        color=ACCENT,
        align=fitz.TEXT_ALIGN_RIGHT,
    )
    insert_textbox(
        page,
        fitz.Rect(344, 56, width - 38, 80),
        "DEVIS - ZONES NUMÉROTÉES",
        fontsize=9,
        fontname=FONT_SEMI,
        color=INK,
        align=fitz.TEXT_ALIGN_RIGHT,
    )

    page.draw_line(
        fitz.Point(38, 98),
        fitz.Point(width - 38, 98),
        color=ACCENT,
        width=1.2,
        overlay=True,
    )

    insert_textbox(
        page,
        fitz.Rect(38, 116, width - 38, 150),
        "GRILLE DE RETOURS PAR ZONES",
        fontsize=20,
        fontname=FONT_EXTRA,
        color=INK,
    )
    insert_textbox(
        page,
        fitz.Rect(38, 151, width - 38, 176),
        "Indiquez le numéro de zone, puis l'action souhaitée. Une consigne courte suffit.",
        fontsize=9,
        fontname=FONT_REGULAR,
        color=MUTED,
    )

    example_rect = fitz.Rect(38, 181, width - 38, 229)
    page.draw_rect(
        example_rect,
        color=ACCENT,
        fill=ACCENT_LIGHT,
        width=0.8,
        fill_opacity=0.82,
        overlay=True,
    )
    insert_textbox(
        page,
        fitz.Rect(51, 190, 117, 208),
        "EXEMPLES",
        fontsize=7.5,
        fontname=FONT_EXTRA,
        color=ACCENT,
    )
    insert_textbox(
        page,
        fitz.Rect(120, 188, width - 49, 220),
        '"Zone 1 -> déplacer à droite"   |   "Zone 3 -> mettre en gras"\n'
        '"Zone 2 -> ajuster l\'alignement"',
        fontsize=8.2,
        fontname=FONT_SEMI,
        color=INK,
        lineheight=1.25,
    )

    insert_textbox(
        page,
        fitz.Rect(38, 238, 314, 257),
        "Cliente : __________________________________",
        fontsize=8,
        fontname=FONT_REGULAR,
        color=MUTED,
    )
    insert_textbox(
        page,
        fitz.Rect(348, 238, width - 38, 257),
        "Date : __________________",
        fontsize=8,
        fontname=FONT_REGULAR,
        color=MUTED,
        align=fitz.TEXT_ALIGN_RIGHT,
    )

    table_x0 = 38
    table_x1 = width - 38
    table_y0 = 267
    header_h = 26
    row_h = 43
    col_zone = table_x0 + 58
    col_element = table_x0 + 224
    table_y1 = table_y0 + header_h + len(ZONES) * row_h

    page.draw_rect(
        fitz.Rect(table_x0, table_y0, table_x1, table_y1),
        color=RULE,
        fill=WHITE,
        width=0.8,
        overlay=True,
    )
    page.draw_rect(
        fitz.Rect(table_x0, table_y0, table_x1, table_y0 + header_h),
        color=ACCENT,
        fill=ACCENT,
        width=0.8,
        overlay=True,
    )

    insert_textbox(
        page,
        fitz.Rect(table_x0 + 5, table_y0 + 8, col_zone - 5, table_y0 + 22),
        "ZONE",
        fontsize=7,
        fontname=FONT_EXTRA,
        color=WHITE,
        align=fitz.TEXT_ALIGN_CENTER,
    )
    insert_textbox(
        page,
        fitz.Rect(col_zone + 10, table_y0 + 8, col_element - 7, table_y0 + 22),
        "ÉLÉMENT DU DEVIS",
        fontsize=7,
        fontname=FONT_EXTRA,
        color=WHITE,
    )
    insert_textbox(
        page,
        fitz.Rect(col_element + 10, table_y0 + 8, table_x1 - 8, table_y0 + 22),
        "MODIFICATION DEMANDÉE",
        fontsize=7,
        fontname=FONT_EXTRA,
        color=WHITE,
    )

    page.draw_line(
        fitz.Point(col_zone, table_y0),
        fitz.Point(col_zone, table_y1),
        color=RULE,
        width=0.7,
        overlay=True,
    )
    page.draw_line(
        fitz.Point(col_element, table_y0),
        fitz.Point(col_element, table_y1),
        color=RULE,
        width=0.7,
        overlay=True,
    )

    for index, zone in enumerate(ZONES):
        y0 = table_y0 + header_h + index * row_h
        y1 = y0 + row_h
        if index % 2:
            page.draw_rect(
                fitz.Rect(table_x0, y0, table_x1, y1),
                color=None,
                fill=(0.985, 0.98, 0.97),
                fill_opacity=1,
                overlay=True,
            )
        page.draw_line(
            fitz.Point(table_x0, y0),
            fitz.Point(table_x1, y0),
            color=RULE,
            width=0.55,
            overlay=True,
        )

        circle_center = fitz.Point((table_x0 + col_zone) / 2, y0 + row_h / 2)
        page.draw_circle(
            circle_center,
            10.5,
            color=ACCENT,
            fill=ACCENT,
            width=0.6,
            overlay=True,
        )
        insert_textbox(
            page,
            fitz.Rect(
                circle_center.x - 10,
                circle_center.y - 5.8,
                circle_center.x + 10,
                circle_center.y + 6.5,
            ),
            str(zone["number"]),
            fontsize=7.2,
            fontname=FONT_EXTRA,
            color=WHITE,
            align=fitz.TEXT_ALIGN_CENTER,
            lineheight=1,
        )
        insert_textbox(
            page,
            fitz.Rect(col_zone + 10, y0 + 14, col_element - 7, y1 - 7),
            zone["name"],
            fontsize=8,
            fontname=FONT_SEMI,
            color=INK,
        )

        note_x0 = col_element + 10
        note_x1 = table_x1 - 10
        page.draw_line(
            fitz.Point(note_x0, y0 + 25),
            fitz.Point(note_x1, y0 + 25),
            color=(0.87, 0.85, 0.82),
            width=0.45,
            dashes="[1.5 2.2] 0",
            overlay=True,
        )
        page.draw_line(
            fitz.Point(note_x0, y0 + 36),
            fitz.Point(note_x1, y0 + 36),
            color=(0.87, 0.85, 0.82),
            width=0.45,
            dashes="[1.5 2.2] 0",
            overlay=True,
        )

    page.draw_line(
        fitz.Point(table_x0, table_y1),
        fitz.Point(table_x1, table_y1),
        color=RULE,
        width=0.7,
        overlay=True,
    )

    footer_y = height - 34
    page.draw_line(
        fitz.Point(38, footer_y - 8),
        fitz.Point(width - 38, footer_y - 8),
        color=RULE,
        width=0.5,
        overlay=True,
    )
    insert_textbox(
        page,
        fitz.Rect(38, footer_y, width - 38, footer_y + 14),
        "BCDevis - Template de validation - Page 2 / 2",
        fontsize=6.8,
        fontname=FONT_SEMI,
        color=MUTED,
        align=fitz.TEXT_ALIGN_CENTER,
    )


def validate_inputs(source: Path) -> None:
    required = [
        source,
        FONT_REGULAR_FILE,
        FONT_SEMI_FILE,
        FONT_EXTRA_FILE,
        LOGO_FILE,
    ]
    missing = [path for path in required if not path.is_file()]
    if missing:
        formatted = "\n".join(f"- {path}" for path in missing)
        raise FileNotFoundError(f"Missing required files:\n{formatted}")


def create_template(source: Path, output: Path) -> None:
    validate_inputs(source)
    if source.resolve() == output.resolve():
        raise ValueError("The output path must be different from the source PDF.")

    doc = fitz.open(source)
    if doc.page_count != 1:
        raise ValueError(f"Expected a one-page source PDF, found {doc.page_count}.")

    first_page = doc[0]
    width = first_page.rect.width
    height = first_page.rect.height
    annotate_first_page(first_page)
    add_review_sheet(doc, width, height)

    metadata = doc.metadata
    metadata.update(
        {
            "title": "BCDevis - Template de retours par zones",
            "subject": "Devis annoté avec 11 zones numérotées et grille de retours",
            "author": "Clinique Bellecour",
            "creator": "BCDevis / PyMuPDF",
            "keywords": "devis, template, zones, validation, retours cliente",
        }
    )
    doc.set_metadata(metadata)

    output.parent.mkdir(parents=True, exist_ok=True)
    doc.save(output, garbage=4, deflate=True, clean=True)
    doc.close()

    check = fitz.open(output)
    if check.page_count != 2:
        raise RuntimeError(f"Expected 2 output pages, found {check.page_count}.")
    if any(abs(page.rect.width - width) > 0.1 for page in check):
        raise RuntimeError("Unexpected page width in generated PDF.")
    if any(abs(page.rect.height - height) > 0.1 for page in check):
        raise RuntimeError("Unexpected page height in generated PDF.")
    check.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add numbered review zones and a feedback sheet to BCDevis."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"One-page source PDF (default: {DEFAULT_SOURCE})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Generated two-page PDF (default: {DEFAULT_OUTPUT})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    create_template(source, output)
    print(output)


if __name__ == "__main__":
    main()
