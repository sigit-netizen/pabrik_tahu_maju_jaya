#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inference Script untuk Model Random Forest Produksi Tahu
Model: best_rf_model.joblib

Struktur Fitur (16 kolom sesuai RandomForest_Tuning.ipynb):
- masak_1, cetak_1 (Hari ke-1)
- masak_2, cetak_2 (Hari ke-2)
- masak_3, cetak_3 (Hari ke-3)
- masak_4, cetak_4 (Hari ke-4)
- masak_5, cetak_5 (Hari ke-5)
- masak_6, cetak_6 (Hari ke-6)
- masak_7, cetak_7 (Hari ke-7)
- minggu_ke: Minggu ke dalam kalender ISO (1-52)
- bulan: Bulan dalam kalender (1-12)

Mendukung 3 Format Input:
1. Format Baris Dataset CSV Langsung:
   {"tanggal": "01-07/04/2025", "masak_1": 34, "cetak_1": 202, ... "masak_7": 25, "cetak_7": 150}
2. Format Array Harian (Database / Simulasi):
   {"data_simulasi": [{"hari": "Senin", "jumlah_masak": 34, "jumlah_cetak": 202}, ...]}
3. Format Default (Otomatis):
   Kirim {} -> Sistem otomatis mengeksekusi 7 hari preset Row #0 dataset.
"""

import sys
import os
import json
from datetime import datetime, timedelta
import joblib
import pandas as pd
import numpy as np

NAMA_HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

# Preset Data Dummy 7 Hari Otomatis (Diambil langsung dari Row #0 DatasetPenjualanTahuv3.csv)
PRESET_DUMMY_7_HARI = [
    {'urutan_hari': 1, 'hari': 'Senin', 'jumlah_masak': 34.0, 'jumlah_cetak': 202.0},
    {'urutan_hari': 2, 'hari': 'Selasa', 'jumlah_masak': 31.0, 'jumlah_cetak': 184.0},
    {'urutan_hari': 3, 'hari': 'Rabu', 'jumlah_masak': 33.0, 'jumlah_cetak': 200.0},
    {'urutan_hari': 4, 'hari': 'Kamis', 'jumlah_masak': 32.0, 'jumlah_cetak': 193.0},
    {'urutan_hari': 5, 'hari': 'Jumat', 'jumlah_masak': 32.0, 'jumlah_cetak': 193.0},
    {'urutan_hari': 6, 'hari': 'Sabtu', 'jumlah_masak': 33.0, 'jumlah_cetak': 197.0},
    {'urutan_hari': 7, 'hari': 'Minggu', 'jumlah_masak': 25.0, 'jumlah_cetak': 150.0},
]

def resolve_model_path():
    """Mencari path best_rf_model.joblib secara dinamis"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(current_dir, 'models', 'best_rf_model.joblib'),
        os.path.join(current_dir, 'best_rf_model.joblib'),
        os.path.join(current_dir, '..', 'model', 'models', 'best_rf_model.joblib'),
        os.path.abspath(r'D:\semester7\capstone\my-app\model\models\best_rf_model.joblib'),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    raise FileNotFoundError(f"Model best_rf_model.joblib tidak ditemukan di lokasi: {candidates}")

def parse_date_like_notebook(tanggal_str):
    """
    Ekstraksi tanggal_bersih, minggu_ke, dan bulan persis seperti Cell 5 notebook:
    df['tanggal_bersih'] = df['tanggal'].str.split('-').str[-1]
    df['tanggal_bersih'] = pd.to_datetime(df['tanggal_bersih'], format='%d/%m/%Y')
    df['minggu_ke'] = df['tanggal_bersih'].dt.isocalendar().week.astype(int)
    df['bulan'] = df['tanggal_bersih'].dt.month
    """
    if not tanggal_str:
        dt = datetime.now()
        return dt, int(dt.isocalendar()[1]), int(dt.month)

    tgl_clean = str(tanggal_str).strip()
    if '-' in tgl_clean and '/' in tgl_clean:
        # Format rentang seperti '01-07/04/2025'
        end_part = tgl_clean.split('-')[-1]
        try:
            dt = datetime.strptime(end_part, '%d/%m/%Y')
            return dt, int(dt.isocalendar()[1]), int(dt.month)
        except Exception:
            pass

    # Format YYYY-MM-DD
    try:
        dt = datetime.strptime(tgl_clean[:10], '%Y-%m-%d')
        return dt, int(dt.isocalendar()[1]), int(dt.month)
    except Exception:
        pass

    # Format DD/MM/YYYY
    try:
        dt = datetime.strptime(tgl_clean[:10], '%d/%m/%Y')
        return dt, int(dt.isocalendar()[1]), int(dt.month)
    except Exception:
        dt = datetime.now()
        return dt, int(dt.isocalendar()[1]), int(dt.month)

def get_builtin_simulation_records(target_dt):
    """Menyiapkan 7 hari data dummy otomatis dengan tanggal riil mundur dari target_dt"""
    records = []
    for i in range(1, 8):
        day_date = target_dt - timedelta(days=8 - i)
        preset_item = PRESET_DUMMY_7_HARI[i - 1]
        records.append({
            'urutan_hari': i,
            'tanggal': day_date.strftime('%Y-%m-%d'),
            'hari': NAMA_HARI[day_date.weekday()],
            'jumlah_masak': float(preset_item['jumlah_masak']),
            'jumlah_cetak': float(preset_item['jumlah_cetak']),
            'sumber': 'Data Dummy Bawaan Sistem (Row #0 DatasetPenjualanTahuv3.csv)'
        })
    return records

def process_prediction(input_payload):
    """
    Menjalankan proses inferensi Random Forest berdasarkan mode:
    - 'database' (Strict: harus tepat 7 hari data riil dari DB)
    - 'simulasi' (Menggunakan data dummy otomatis, format baris dataset, atau array kustom 7 hari)
    """
    mode = str(input_payload.get('mode', 'database')).lower()
    model_path = resolve_model_path()
    model = joblib.load(model_path)

    # ── JALUR A: FORMAT KOLOM DATASET CSV LANGSUNG ────────────────────────────
    # Contoh: {"tanggal": "01-07/04/2025", "masak_1": 34, "cetak_1": 202, ...}
    masak_keys = [k for k in input_payload.keys() if str(k).startswith('masak_')]
    cetak_keys = [k for k in input_payload.keys() if str(k).startswith('cetak_')]
    has_dataset_cols = len(masak_keys) > 0 or len(cetak_keys) > 0

    if has_dataset_cols:
        extra_keys = [k for k in (masak_keys + cetak_keys) if str(k).split('_')[-1].isdigit() and int(str(k).split('_')[-1]) > 7]
        if extra_keys:
            raise ValueError(
                f"Data yang dikirim melebihi 7 hari (ditemukan kolom: {', '.join(extra_keys)}). "
                f"Model Random Forest hanya membutuhkan tepat 7 hari historis produksi (masak_1 s/d masak_7 dan cetak_1 s/d cetak_7)."
            )

        missing_keys = []
        for i in range(1, 8):
            if input_payload.get(f'masak_{i}') is None or input_payload.get(f'masak_{i}') == '':
                missing_keys.append(f'masak_{i}')
            if input_payload.get(f'cetak_{i}') is None or input_payload.get(f'cetak_{i}') == '':
                missing_keys.append(f'cetak_{i}')

        if missing_keys:
            nums = [int(str(k).split('_')[-1]) for k in (masak_keys + cetak_keys) if str(k).split('_')[-1].isdigit()]
            hari_terdeteksi = max(nums) if nums else 0
            raise ValueError(
                f"Data simulasi tidak lengkap / kurang dari 7 hari (hanya terdeteksi {hari_terdeteksi} hari). "
                f"Model Random Forest membutuhkan tepat 7 hari historis produksi (masak_1..7 dan cetak_1..7). "
                f"Kolom yang belum diisi: {', '.join(missing_keys)}."
            )

        last_dt, minggu_ke, bulan = parse_date_like_notebook(input_payload.get('tanggal'))
        target_dt = last_dt + timedelta(days=1)

        fitur_dict = {}
        rincian_7_hari = []
        for i in range(1, 8):
            m = float(input_payload.get(f'masak_{i}', 0))
            c = float(input_payload.get(f'cetak_{i}', 0))
            fitur_dict[f'masak_{i}'] = m
            fitur_dict[f'cetak_{i}'] = c
            d_i = last_dt - timedelta(days=7 - i)
            rincian_7_hari.append({
                'urutan_hari': i,
                'tanggal': d_i.strftime('%Y-%m-%d'),
                'hari': NAMA_HARI[d_i.weekday()],
                'jumlah_masak': m,
                'jumlah_cetak': c,
                'sumber': 'Format Kolom Dataset CSV Langsung'
            })

        fitur_dict['minggu_ke'] = minggu_ke
        fitur_dict['bulan'] = bulan
        sumber_deskripsi = f"Input Kolom Dataset Langsung (Tanggal Acuan: {last_dt.strftime('%d/%m/%Y')})"

    # ── JALUR B: MODE SIMULASI DATA DUMMY ─────────────────────────────────────
    elif mode in ['simulasi', 'dummy']:
        raw_records = input_payload.get('data_simulasi') or input_payload.get('data_7_hari') or []
        anchor_date_str = input_payload.get('tanggal') or input_payload.get('tanggal_acuan')
        periode_mulai_str = input_payload.get('periode_mulai')

        if periode_mulai_str:
            try:
                target_dt = datetime.strptime(periode_mulai_str[:10], '%Y-%m-%d')
            except Exception:
                target_dt = datetime.now() + timedelta(days=1)
        elif anchor_date_str:
            last_dt, _, _ = parse_date_like_notebook(anchor_date_str)
            target_dt = last_dt + timedelta(days=1)
        else:
            target_dt = datetime.now() + timedelta(days=1)

        if raw_records and len(raw_records) > 0:
            if len(raw_records) != 7:
                raise ValueError(
                    f"Validasi Gagal: Data simulasi yang dikirim harus tepat 7 hari (diterima: {len(raw_records)} hari). "
                    f"Model Random Forest membutuhkan tepat 7 hari data produksi."
                )
            records = raw_records
            sumber_deskripsi = "Input Kustom Pengguna (7 Hari)"
        else:
            records = get_builtin_simulation_records(target_dt)
            sumber_deskripsi = "Data Dummy Bawaan Sistem (Row #0 DatasetPenjualanTahuv3.csv)"

        try:
            day7_str = records[6].get('tanggal', '')[:10]
            last_dt, minggu_ke, bulan = parse_date_like_notebook(day7_str)
        except Exception:
            last_dt = target_dt - timedelta(days=1)
            minggu_ke = int(last_dt.isocalendar()[1])
            bulan = int(last_dt.month)

        target_dt = last_dt + timedelta(days=1)

        fitur_dict = {}
        rincian_7_hari = []
        for i, item in enumerate(records, start=1):
            m = float(item.get('jumlah_masak') or item.get('masak') or 0)
            c = float(item.get('jumlah_cetak') or item.get('cetak') or 0)
            tgl = item.get('tanggal') or f"Hari-{i}"
            hari_nama = item.get('hari') or f"Hari-{i}"
            
            fitur_dict[f'masak_{i}'] = m
            fitur_dict[f'cetak_{i}'] = c
            rincian_7_hari.append({
                'urutan_hari': i,
                'tanggal': tgl,
                'hari': hari_nama,
                'jumlah_masak': m,
                'jumlah_cetak': c,
                'sumber': item.get('sumber', sumber_deskripsi)
            })

        fitur_dict['minggu_ke'] = minggu_ke
        fitur_dict['bulan'] = bulan

    # ── JALUR C: MODE DATABASE RIIL (STRICT VALIDATION 7 HARI) ────────────────
    else:
        raw_records = input_payload.get('data_7_hari') or []
        jumlah_hari = len(raw_records)
        if jumlah_hari < 7:
            daftar_tgl = [r.get('tanggal') for r in raw_records if isinstance(r, dict) and r.get('tanggal')]
            raise ValueError(
                f"Data produksi di database belum mencukupi 7 hari (hanya ditemukan {jumlah_hari} hari: {daftar_tgl}). "
                f"Model Random Forest membutuhkan tepat 7 hari data historis produksi. "
                f"Silakan lengkapi data pada tabel product_harian atau gunakan mode 'simulasi' untuk pengujian data dummy otomatis."
            )
        if jumlah_hari > 7:
            raise ValueError(
                f"Data produksi yang dikirim melebihi 7 hari (diterima {jumlah_hari} hari). "
                f"Model Random Forest membutuhkan tepat 7 hari data historis produksi."
            )

        sorted_records = sorted(
            raw_records,
            key=lambda x: str(x.get('tanggal', '')) if isinstance(x, dict) else ''
        )

        rincian_7_hari = []
        fitur_dict = {}
        for i, item in enumerate(sorted_records, start=1):
            tgl = item.get('tanggal') or f"Hari-{i}"
            m = float(item.get('jumlah_masak') or item.get('masak') or 0)
            c = float(item.get('jumlah_cetak') or item.get('cetak') or 0)

            if c <= 0:
                raise ValueError(
                    f"Data produksi tanggal {tgl} (hari ke-{i}) memiliki jumlah cetak <= 0. "
                    f"Semua 7 hari harus memiliki data produksi yang valid untuk peramalan."
                )

            try:
                dt_obj = datetime.strptime(str(tgl)[:10], '%Y-%m-%d')
                hari_nama = NAMA_HARI[dt_obj.weekday()]
            except Exception:
                hari_nama = f"Hari-{i}"

            fitur_dict[f'masak_{i}'] = m
            fitur_dict[f'cetak_{i}'] = c
            rincian_7_hari.append({
                'urutan_hari': i,
                'tanggal': str(tgl)[:10],
                'hari': hari_nama,
                'jumlah_masak': m,
                'jumlah_cetak': c,
                'sumber': 'database_product_harian'
            })

        last_tgl = str(sorted_records[-1].get('tanggal', ''))[:10]
        last_dt, minggu_ke, bulan = parse_date_like_notebook(last_tgl)
        target_dt = last_dt + timedelta(days=1)

        fitur_dict['minggu_ke'] = minggu_ke
        fitur_dict['bulan'] = bulan
        sumber_deskripsi = "Data Riil Database Supabase (product_harian)"

    # ── EKSEKUSI MODEL RANDOM FOREST (16 FITUR) ───────────────────────────────
    feature_order = [
        'masak_1', 'cetak_1', 'masak_2', 'cetak_2', 'masak_3', 'cetak_3',
        'masak_4', 'cetak_4', 'masak_5', 'cetak_5', 'masak_6', 'cetak_6',
        'masak_7', 'cetak_7', 'minggu_ke', 'bulan'
    ]
    df_row = {col: [fitur_dict[col]] for col in feature_order}
    X = pd.DataFrame(df_row)

    prediction_raw = float(model.predict(X)[0])
    total_cetak_prediksi = int(round(prediction_raw))

    # Rincian 7 hari ke depan (Senin s/d Minggu)
    detail_harian = []
    bobot_hari = [0.135, 0.138, 0.142, 0.140, 0.145, 0.155, 0.145]
    total_bobot = sum(bobot_hari)

    for i in range(7):
        cur_date = target_dt + timedelta(days=i)
        hari_nama = NAMA_HARI[cur_date.weekday()]
        prop = bobot_hari[i] / total_bobot
        estimasi_hari = int(round(prediction_raw * prop))
        detail_harian.append({
            'hari': hari_nama,
            'tanggal': cur_date.strftime('%Y-%m-%d'),
            'estimasi_cetak': estimasi_hari
        })

    # Selaraskan selisih pembulatan
    selisih = total_cetak_prediksi - sum(d['estimasi_cetak'] for d in detail_harian)
    if selisih != 0 and detail_harian:
        detail_harian[-1]['estimasi_cetak'] += selisih

    periode_selesai = (target_dt + timedelta(days=6)).strftime('%Y-%m-%d')
    tgl_awal_input = rincian_7_hari[0]['tanggal'] if rincian_7_hari else ''
    tgl_akhir_input = rincian_7_hari[-1]['tanggal'] if rincian_7_hari else ''

    return {
        'status': 'success',
        'mode': mode,
        'model_version': 'RandomForestRegressor-Tuned-v1',
        'total_cetak_prediksi': total_cetak_prediksi,
        'periode_mulai': target_dt.strftime('%Y-%m-%d'),
        'periode_selesai': periode_selesai,
        'minggu_ke': minggu_ke,
        'bulan': bulan,
        'detail_harian': detail_harian,
        'basis_7_hari_input': {
            'sumber_data': sumber_deskripsi,
            'rentang_7_hari': f"{tgl_awal_input} s/d {tgl_akhir_input}",
            'jumlah_hari_digunakan': len(rincian_7_hari),
            'rincian_per_hari': rincian_7_hari
        },
        'metrik_evaluasi': {
            'mae': 6.42,
            'r2_score': 0.7712,
            'catatan': 'Model Random Forest (R2 77%) hasil hyperparameter tuning'
        },
        'fitur_input_16': fitur_dict
    }

def main():
    payload = {}
    if len(sys.argv) > 1:
        arg_str = sys.argv[1].strip()
        if arg_str.startswith('{') or arg_str.startswith('['):
            try:
                parsed = json.loads(arg_str)
                if isinstance(parsed, list):
                    payload = {'data_7_hari': parsed}
                elif isinstance(parsed, dict):
                    payload = parsed
            except Exception as e:
                print(json.dumps({'status': 'error', 'message': f'Gagal parse arg JSON: {str(e)}'}))
                sys.exit(1)
    else:
        try:
            if not sys.stdin.isatty():
                stdin_text = sys.stdin.read().strip()
                if stdin_text:
                    parsed = json.loads(stdin_text)
                    if isinstance(parsed, list):
                        payload = {'data_7_hari': parsed}
                    elif isinstance(parsed, dict):
                        payload = parsed
        except Exception:
            pass

    try:
        result = process_prediction(payload)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        error_res = {
            'status': 'error',
            'message': str(e),
            'model': 'best_rf_model.joblib'
        }
        print(json.dumps(error_res, ensure_ascii=False))
        sys.exit(1)

if __name__ == '__main__':
    main()
