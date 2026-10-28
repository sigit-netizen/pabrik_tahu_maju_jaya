#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Inference Script untuk Model Random Forest Produksi Tahu
Model: best_rf_model.joblib
Fitur (16 kolom sesuai RandomForest_Tuning.ipynb):
- masak_1, cetak_1 (Hari ke-1 / H-7)
- masak_2, cetak_2 (Hari ke-2 / H-6)
- masak_3, cetak_3 (Hari ke-3 / H-5)
- masak_4, cetak_4 (Hari ke-4 / H-4)
- masak_5, cetak_5 (Hari ke-5 / H-3)
- masak_6, cetak_6 (Hari ke-6 / H-2)
- masak_7, cetak_7 (Hari ke-7 / H-1)
- minggu_ke: Minggu ke dalam kalender ISO (1-52)
- bulan: Bulan dalam kalender (1-12)
"""

import sys
import os
import json
from datetime import datetime, timedelta
import joblib
import pandas as pd
import numpy as np

# Rata-rata / Baseline data dummy dari DatasetPenjualanTahuv3.csv
DEFAULT_DUMMY_MASAK = 32.0
DEFAULT_DUMMY_CETAK = 190.0

NAMA_HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

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

def build_features_from_daily_records(records, target_date_str=None, dummy_masak=DEFAULT_DUMMY_MASAK, dummy_cetak=DEFAULT_DUMMY_CETAK):
    """
    Menyusun 16 fitur dari array data harian (database + dummy fallback).
    Jika data dari database kurang dari 7 hari atau ada hari yang kosong/0,
    akan dilengkapi dengan nilai data dummy secara mulus.
    """
    # 1. Tentukan tanggal target prediksi (default: Senin minggu berikutnya)
    if target_date_str:
        try:
            target_dt = datetime.strptime(target_date_str, '%Y-%m-%d')
        except Exception:
            target_dt = datetime.now() + timedelta(days=1)
    else:
        # Default: 1 hari setelah hari ini
        target_dt = datetime.now() + timedelta(days=1)

    # Minggu ke dan Bulan target (sesuai dt.isocalendar().week dan dt.month di notebook)
    minggu_ke = int(target_dt.isocalendar()[1])
    bulan = int(target_dt.month)

    # 2. Susun 7 hari kalender (H-7 s/d H-1 sebelum target_dt)
    fitur_dict = {}
    riil_count = 0
    dummy_count = 0

    # Peta dari input records: tanggal -> {masak, cetak}
    records_map = {}
    if isinstance(records, list):
        for r in records:
            if isinstance(r, dict):
                tgl = r.get('tanggal') or r.get('date') or r.get('created_at')
                if tgl:
                    # Ambil hanya YYYY-MM-DD
                    tgl_clean = str(tgl)[:10]
                    m = float(r.get('jumlah_masak') or r.get('masak') or 0)
                    c = float(r.get('jumlah_cetak') or r.get('cetak') or 0)
                    records_map[tgl_clean] = {'masak': m, 'cetak': c}

    for i in range(1, 8):
        # Hari ke-1 adalah H-7, Hari ke-7 adalah H-1
        day_offset = 8 - i
        d = target_dt - timedelta(days=day_offset)
        d_key = d.strftime('%Y-%m-%d')

        m_val = None
        c_val = None

        if d_key in records_map:
            item = records_map[d_key]
            # Jika ada nilai riil positif (> 0), gunakan data database
            if item['cetak'] > 0:
                c_val = item['cetak']
                m_val = item['masak'] if item['masak'] > 0 else dummy_masak
                riil_count += 1

        # Jika tidak ada di database, gunakan data dummy baseline
        if c_val is None:
            c_val = dummy_cetak
            m_val = dummy_masak
            dummy_count += 1

        fitur_dict[f'masak_{i}'] = float(m_val)
        fitur_dict[f'cetak_{i}'] = float(c_val)

    fitur_dict['minggu_ke'] = int(minggu_ke)
    fitur_dict['bulan'] = int(bulan)

    return fitur_dict, target_dt, riil_count, dummy_count

def predict_production(input_payload):
    """Fungsi utama menjalankan prediksi dengan best_rf_model.joblib"""
    model_path = resolve_model_path()
    model = joblib.load(model_path)

    records = input_payload.get('data_7_hari') or input_payload.get('records') or []
    target_date_str = input_payload.get('periode_mulai') or input_payload.get('target_date')

    dummy_cfg = input_payload.get('fallback_dummy') or {}
    dummy_masak = float(dummy_cfg.get('masak') or DEFAULT_DUMMY_MASAK)
    dummy_cetak = float(dummy_cfg.get('cetak') or DEFAULT_DUMMY_CETAK)

    # Jika payload langsung mengirimkan 16 fitur lengkap
    if 'masak_1' in input_payload and 'cetak_7' in input_payload:
        feature_order = [
            'masak_1', 'cetak_1', 'masak_2', 'cetak_2', 'masak_3', 'cetak_3',
            'masak_4', 'cetak_4', 'masak_5', 'cetak_5', 'masak_6', 'cetak_6',
            'masak_7', 'cetak_7', 'minggu_ke', 'bulan'
        ]
        fitur_dict = {col: [float(input_payload[col])] for col in feature_order}
        X = pd.DataFrame(fitur_dict)
        target_dt = datetime.now() + timedelta(days=1)
        riil_count = 7
        dummy_count = 0
    else:
        fitur_dict, target_dt, riil_count, dummy_count = build_features_from_daily_records(
            records, target_date_str, dummy_masak, dummy_cetak
        )
        feature_order = [
            'masak_1', 'cetak_1', 'masak_2', 'cetak_2', 'masak_3', 'cetak_3',
            'masak_4', 'cetak_4', 'masak_5', 'cetak_5', 'masak_6', 'cetak_6',
            'masak_7', 'cetak_7', 'minggu_ke', 'bulan'
        ]
        df_row = {col: [fitur_dict[col]] for col in feature_order}
        X = pd.DataFrame(df_row)

    # Jalankan model prediksi
    prediction_raw = float(model.predict(X)[0])
    total_cetak_prediksi = int(round(prediction_raw))

    # Tentukan rentang 7 hari ke depan mulai target_dt
    detail_harian = []
    # Pola bobot harian (Senin - Minggu): akhir pekan biasanya mengalami peningkatan permintaan
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

    # Selaraskan total agar persis sama dengan total_cetak_prediksi
    selisih = total_cetak_prediksi - sum(d['estimasi_cetak'] for d in detail_harian)
    if selisih != 0 and detail_harian:
        detail_harian[-1]['estimasi_cetak'] += selisih

    periode_selesai = (target_dt + timedelta(days=6)).strftime('%Y-%m-%d')

    return {
        'status': 'success',
        'model_version': 'RandomForestRegressor-Tuned-v1',
        'total_cetak_prediksi': total_cetak_prediksi,
        'periode_mulai': target_dt.strftime('%Y-%m-%d'),
        'periode_selesai': periode_selesai,
        'minggu_ke': int(fitur_dict['minggu_ke'] if isinstance(fitur_dict['minggu_ke'], (int, float)) else fitur_dict['minggu_ke'][0]),
        'bulan': int(fitur_dict['bulan'] if isinstance(fitur_dict['bulan'], (int, float)) else fitur_dict['bulan'][0]),
        'detail_harian': detail_harian,
        'metrik_evaluasi': {
            'mae': 6.42,
            'r2_score': 0.7712,
            'catatan': 'Model Random Forest (R2 77%) hasil hyperparameter tuning'
        },
        'sumber_fitur': {
            'jumlah_hari_dari_database': riil_count,
            'jumlah_hari_dari_dummy': dummy_count,
            'total_fitur': 16,
            'fitur_terpakai': {k: (v[0] if isinstance(v, list) else v) for k, v in (fitur_dict.items())}
        }
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
        # Baca dari stdin jika ada input pipe
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
        result = predict_production(payload)
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
