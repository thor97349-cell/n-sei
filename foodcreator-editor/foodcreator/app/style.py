"""Tema visual (claro, com destaque laranja)."""

ACCENT = "#E8590C"

STYLESHEET = f"""
QWidget {{
    font-size: 10pt;
    color: #1f2328;
}}
QWidget:disabled {{
    color: #9aa1a8;
}}
QMainWindow, QScrollArea, QScrollArea > QWidget > QWidget {{
    background: #f6f7f9;
}}
QGroupBox {{
    background: #ffffff;
    border: 1px solid #e3e6ea;
    border-radius: 10px;
    margin-top: 14px;
    padding: 12px 10px 10px 10px;
    font-weight: 600;
}}
QGroupBox::title {{
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 4px;
    color: #444c56;
}}
QLabel#hint {{
    color: #57606a;
    font-weight: normal;
}}
QLabel#title {{
    font-size: 16pt;
    font-weight: 700;
    color: {ACCENT};
}}
QPushButton {{
    background: #ffffff;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    padding: 6px 12px;
}}
QPushButton:hover {{
    border-color: {ACCENT};
}}
QPushButton:disabled {{
    color: #9aa1a8;
    background: #f0f1f3;
}}
QPushButton#primary {{
    background: {ACCENT};
    color: white;
    border: none;
    font-weight: 700;
    font-size: 11pt;
    padding: 10px 22px;
}}
QPushButton#primary:hover {{
    background: #d9480f;
}}
QPushButton#primary:disabled {{
    background: #f3b79a;
}}
QTableWidget {{
    background: #ffffff;
    border: 1px solid #e3e6ea;
    border-radius: 8px;
    gridline-color: #eef0f2;
}}
QHeaderView::section {{
    background: #f6f7f9;
    border: none;
    border-bottom: 1px solid #e3e6ea;
    padding: 6px;
    font-weight: 600;
}}
QProgressBar {{
    border: 1px solid #d0d7de;
    border-radius: 6px;
    text-align: center;
    background: #ffffff;
    height: 20px;
}}
QProgressBar::chunk {{
    background: {ACCENT};
    border-radius: 5px;
}}
QPlainTextEdit {{
    background: #ffffff;
    border: 1px solid #e3e6ea;
    border-radius: 8px;
}}
"""
