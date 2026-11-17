"""
Script Validasi Model Random Forest (.joblib):
Dapat dijalankan secara mandiri tanpa memerlukan library pandas.
Hanya membutuhkan joblib & numpy/scikit-learn bawaan Python environment.
"""

import os
import sys

# Menambahkan path site-packages Python user jika terminal dijalankan dari shell berbeda
appdata_site_packages = os.path.expanduser(
    r"~\AppData\Local\Programs\Python\Python311\Lib\site-packages"
)
if os.path.exists(appdata_site_packages) and appdata_site_packages not in sys.path:
    sys.path.insert(0, appdata_site_packages)

import warnings
warnings.filterwarnings("ignore")

try:
    import joblib
except ImportError:
    print("Error: Library 'joblib' tidak ditemukan. Silakan install dengan: pip install joblib")
    sys.exit(1)

def uji_model():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    joblib_path = os.path.join(base_dir, "models", "best_rf_model.joblib")

    print("=" * 65)
    print("  UJI VALIDASI MODEL RANDOM FOREST (.joblib)")
    print("=" * 65)

    # 1. 16 Fitur Input (Data Riil Dashboard 16 November 2026):
    # Hari 1-5 (10-14 Nov): 0 masak, 0 cetak
    # Hari 6 (15 Nov)    : 6 masak, 36 cetak
    # Hari 7 (16 Nov)    : 11 masak, 66 cetak
    # Minggu ke-47 (ISO), Bulan ke-11 (November)
    fitur_dict = {
        "Hari 1 (10 Nov)": (0, 0),
        "Hari 2 (11 Nov)": (0, 0),
        "Hari 3 (12 Nov)": (0, 0),
        "Hari 4 (13 Nov)": (0, 0),
        "Hari 5 (14 Nov)": (0, 0),
        "Hari 6 (15 Nov)": (6, 36),
        "Hari 7 (16 Nov)": (11, 66),
    }

    # Format array 16 fitur persis sesuai urutan training scikit-learn
    fitur_16 = [
        0, 0,    # masak_1, cetak_1
        0, 0,    # masak_2, cetak_2
        0, 0,    # masak_3, cetak_3
        0, 0,    # masak_4, cetak_4
        0, 0,    # masak_5, cetak_5
        6, 36,   # masak_6, cetak_6
        11, 66,  # masak_7, cetak_7
        47, 11   # minggu_ke, bulan
    ]

    print("\n[1] DATA INPUT FITUR HISTORIS (7 Hari ke Belakang):")
    for hari, (m, c) in fitur_dict.items():
        print(f"  - {hari:<16}: {m:>2} masak, {c:>2} cetak")
    print(f"  - {'Minggu ke-ISO':<16}: 47")
    print(f"  - {'Bulan':<16}: 11 (November)")

    # 2. Cek apakah pandas tersedia (jika ada gunakan DataFrame, jika tidak gunakan List 2D langsung)
    try:
        import pandas as pd
        kolom_fitur = [
            "masak_1", "cetak_1", "masak_2", "cetak_2", "masak_3", "cetak_3",
            "masak_4", "cetak_4", "masak_5", "cetak_5", "masak_6", "cetak_6",
            "masak_7", "cetak_7", "minggu_ke", "bulan"
        ]
        input_data = pd.DataFrame([fitur_16], columns=kolom_fitur)
    except ImportError:
        input_data = [fitur_16]

    # 3. Load Model .joblib dan Jalankan Prediksi
    print(f"\n[2] MEMUAT MODEL:")
    print(f"  Path: {joblib_path}")
    
    if not os.path.exists(joblib_path):
        print(f"Error: File model tidak ditemukan di {joblib_path}")
        return

    model = joblib.load(joblib_path)
    hasil_pred_raw = float(model.predict(input_data)[0])
    total_cetak_joblib = round(hasil_pred_raw)
    rata_rata_joblib = round(total_cetak_joblib / 7)

    print(f"\n[3] HASIL PREDIKSI .joblib:")
    print(f"  >> Output Float Mentah   : {hasil_pred_raw:.8f}")
    print(f"  >> Total Estimasi Cetak  : {total_cetak_joblib} cetak")
    print(f"  >> Rata-rata per Hari    : {rata_rata_joblib} cetak")

    # 4. Perbandingan dengan Web Dashboard
    total_web = 1241
    rata_web = 177

    print("\n[4] KOMPARASI DENGAN TAMPILAN WEB DASHBOARD:")
    print(f"  * Web Dashboard (ONNX)  : {total_web} cetak (Rata-rata: {rata_web} cetak)")
    print(f"  * Python Model (.joblib): {total_cetak_joblib} cetak (Rata-rata: {rata_rata_joblib} cetak)")
    print(f"  * Selisih (Delta)       : {abs(total_cetak_joblib - total_web)}")

    print("\n" + "=" * 65)
    if total_cetak_joblib == total_web:
        print("  STATUS: 100% PERSIS DAN IDENTIK! (1.241 CETAK)")
    else:
        print("  STATUS: Berbeda.")
    print("=" * 65)

if __name__ == "__main__":
    uji_model()
