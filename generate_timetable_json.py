import urllib.request
import csv
import io
import json
import re

spreadsheet_id = "1vlTuotLw34fedME3gNQj09cZw-todVomxAiu5P1wZ6Q"
days = [
    ("Monday", "1882612924"),
    ("Tuesday", "945396749"),
    ("Wednesday", "542677125"),
    ("Thursday", "571927841"),
    ("Friday", "1783333514"),
    ("Saturday", "1949393871")
]

TIME_RE = re.compile(r'(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})')

COURSE_NAMES = {
    "Adv Algo": "Advanced Analysis of Algorithms",
    "Adv OS": "Advanced Operating Systems",
    "App Prog": "Applied Programming",
    "Agentic AI": "Agentic AI",
    "Adv Topics in Gen AI": "Advanced Topics in Generative AI",
    "DS Tools & Tech": "Data Science Tools & Technologies",
    "NLP": "Natural Language Processing",
    "Stat & Math": "Statistical & Mathematical Foundations for Data Science",
    "Research Methodology": "Research Methodology",
    "Data Visualization": "Data Visualization",
    "Adv AI": "Advanced Artificial Intelligence",
    "App Comp Vision": "Applied Computer Vision",
    "Math Foundations of AI": "Mathematical Foundations of AI",
    "Applied Info Sec": "Applied Information Security",
    "ML": "Machine Learning",
    "Secure Sys": "Secure Systems Development",
    "Adv Quality Assur": "Advanced Quality Assurance",
    "Adv S/w Arch": "Advanced Software Architecture",
    "Empirical S/w Engg": "Empirical Software Engineering",
    "Engg AI": "Engineering AI Systems",
    "DB & OS": "Database & Operating Systems",
    "Data St & Algo": "Data Structures & Algorithms",
    "Math for CI": "Mathematics for Computational Intelligence",
    "Prog for AI": "Programming for AI",
    "Found of AI": "Foundations of AI",
    "Found of Health Info Sys": "Foundations of Health Information Systems",
    "Prog for Digital Health": "Programming for Digital Health",
    "Securing Cloud": "Securing Cloud Environments",
    "Adv Topics in Req Engg": "Advanced Topics in Requirements Engineering",
    "UHQ-I & II": "Understanding Quran I & II"
}

def extract_ms_timetable():
    ms_events = []
    
    for day_name, gid in days:
        url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?tqx=out:csv&gid={gid}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8", errors="replace")
        rows = list(csv.reader(io.StringIO(content)))
        
        if not rows or len(rows) < 5:
            continue
            
        def fill_row(r):
            res = []
            last = ""
            for x in r:
                x = x.strip()
                if x: last = x
                res.append(last)
            return res

        header_row = rows[4]
        default_time_row = fill_row(header_row)
        
        # Dynamically locate evening room column (last column with 'Room'/'Lab'/'Room/ Time')
        room_col_indices = [i for i, val in enumerate(header_row) if val.strip().lower() in ["room", "lab", "room/ time"]]
        evening_room_col = room_col_indices[-1] if room_col_indices else 30
        
        # Scan evening slots
        for r_i in range(5, len(rows)):
            row = rows[r_i]
            if not row or len(row) <= evening_room_col:
                continue
                
            room_evening = row[evening_room_col].strip()
            if not room_evening or room_evening.lower() in ["room", "lab", "room/ time"]:
                continue
                
            for c_i in range(evening_room_col + 1, len(row)):
                cell_text = row[c_i].strip()
                if not cell_text or cell_text in ["Room", "Lab", "P R A Y E R", "B R E A K"] or "inc. 10 min. break" in cell_text:
                    continue
                
                # Exclude all PhD courses
                if any(phd_kw in cell_text for phd_kw in ["PHD-C", "PHD-A", "PHD-B", "PCS", "PhD", "PHD", "Parallel Dist Sys", "Software Process Mining", "Adv Computer Vision", "Advanced Topics in NLP"]):
                    continue

                default_time = default_time_row[c_i] if c_i < len(default_time_row) else "05:20 - 06:40"
                
                # Check for override time
                override = TIME_RE.search(cell_text)
                if override:
                    time_slot = override.group(1).strip()
                    clean_cell = cell_text.replace(override.group(0), "").strip()
                else:
                    time_slot = default_time
                    clean_cell = cell_text
                
                if "-" in time_slot:
                    parts = time_slot.split("-")
                    time_slot = f"{parts[0].strip()} - {parts[1].strip()}"
                
                # Clean extra term suffixes e.g. "Spring-2026 & fall-2025"
                clean_cell = re.sub(r'Spring[-\s]*\d+.*$', '', clean_cell, flags=re.IGNORECASE).strip()

                # Department & Program classification for MS students
                sec_m = re.findall(r'\(([^)]+)\)', clean_cell)
                tag = sec_m[-1].upper().strip() if sec_m else ""
                
                if "AIHS" in tag or "AIHS" in clean_cell:
                    dept = "MS-AIHS"
                    dept_name = "MS AI in Health Sciences"
                elif re.search(r'\bCI\b', tag) or "(CI)" in clean_cell:
                    dept = "MS-CI"
                    dept_name = "MS Computational Intelligence"
                elif re.search(r'\bDS\b', tag) or "(DS)" in clean_cell:
                    dept = "MS-DS"
                    dept_name = "MS Data Science"
                elif re.search(r'\bCS\b', tag) or "(CS)" in clean_cell or "(MS-CS)" in clean_cell:
                    dept = "MS-CS"
                    dept_name = "MS Computer Science"
                elif re.search(r'\bSE\b', tag) or "(SE)" in clean_cell or "(MS-SE)" in clean_cell:
                    dept = "MS-SE"
                    dept_name = "MS Software Engineering"
                elif re.search(r'\bAI\b', tag) or "(AI)" in clean_cell or "(AI-A)" in clean_cell or "(AI-B)" in clean_cell:
                    dept = "MS-AI"
                    dept_name = "MS Artificial Intelligence"
                elif re.search(r'\bCY\b', tag) or "(CY)" in clean_cell or "(MS-CY)" in clean_cell or "Cyber" in clean_cell:
                    dept = "MS-CY"
                    dept_name = "MS Cyber Security"
                else:
                    dept = "MS-ELECTIVE"
                    dept_name = "MS Electives"

                # Track / Section (e.g. AI-A -> Section AI-A, AI-B -> Section AI-B)
                track = "General"
                section = ""
                section_label = ""
                m_trk = re.search(r'[- ]([A-Z])\b', tag)
                if m_trk:
                    sec_letter = m_trk.group(1).upper()
                    track = f"Section {sec_letter}"
                    section = tag
                    section_label = f"Section {tag}"
                elif tag:
                    section = tag

                course_name = re.sub(r'\(.*?\)', '', clean_cell).strip()
                course_full = COURSE_NAMES.get(course_name, course_name)

                ms_events.append({
                    "id": f"{day_name[:3]}_{r_i}_{c_i}",
                    "day": day_name,
                    "room": room_evening,
                    "time": time_slot,
                    "course_code": course_name,
                    "course_full": course_full,
                    "department": dept,
                    "department_name": dept_name,
                    "track": track,
                    "section": section,
                    "section_label": section_label,
                    "raw": cell_text
                })

    return ms_events

if __name__ == "__main__":
    events = extract_ms_timetable()
    print(f"Extracted {len(events)} MS-only timetable events.")
    
    with open("timetable_data.json", "w", encoding="utf-8") as f:
        json.dump(events, f, indent=2, ensure_ascii=False)
        
    with open("timetable_data.js", "w", encoding="utf-8") as f:
        f.write("window.TIMETABLE_DATA = ")
        json.dump(events, f, indent=2, ensure_ascii=False)
        f.write(";\n")
        
    print("Updated timetable_data.json and timetable_data.js successfully!")
