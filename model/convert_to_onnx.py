#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script Konversi Model Machine Learning:
Dari best_rf_model.joblib ke best_rf_model.onnx (Open Neural Network Exchange).

Memungkinkan inferensi native super cepat langsung di Node.js (Next.js server)
menggunakan library 'onnxruntime-node', tanpa perlu dependensi Python di server produksi (seperti Vercel).

Fitur (16 Kolom):
1.  masak_1, cetak_1 (Hari ke-1)
2.  masak_2, cetak_2 (Hari ke-2)
3.  masak_3, cetak_3 (Hari ke-3)
4.  masak_4, cetak_4 (Hari ke-4)
5.  masak_5, cetak_5 (Hari ke-5)
6.  masak_6, cetak_6 (Hari ke-6)
7.  masak_7, cetak_7 (Hari ke-7)
8.  minggu_ke (Minggu ke dalam ISO kalender 1-52)
9.  bulan (Bulan 1-12)
"""

import os
import sys
import joblib

try:
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
except ImportError:
    print("Error: Library 'skl2onnx' belum terinstal. Silakan jalankan: pip install skl2onnx onnx")
    sys.exit(1)

def convert_rf_to_onnx():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, 'models', 'best_rf_model.joblib')
    output_onnx_path = os.path.join(base_dir, 'models', 'best_rf_model.onnx')

    if not os.path.isfile(model_path):
        print(f"Error: Model source '{model_path}' tidak ditemukan!")
        sys.exit(1)

    print(f"[1/3] Memuat model joblib dari: {model_path} ...")
    model = joblib.load(model_path)

    # 16 Fitur input (Float32 Tensor dengan batch dinamis)
    # Shape: [batch_size, 16]
    initial_type = [('float_input', FloatTensorType([None, 16]))]

    print("[2/3] Mengonversi Random Forest Regressor ke ONNX format (opset 12)...")
    onnx_model = convert_sklearn(
        model,
        initial_types=initial_type,
        target_opset=12,
        doc_string="Model Random Forest Regressor untuk Prediksi Produksi Tahu (16 Fitur: masak 1-7, cetak 1-7, minggu_ke, bulan)"
    )

    print(f"[3/3] Menyimpan file model ONNX ke: {output_onnx_path} ...")
    with open(output_onnx_path, 'wb') as f:
        f.write(onnx_model.SerializeToString())

    file_size_kb = os.path.getsize(output_onnx_path) / 1024
    print(f"Sukses! Model ONNX berhasil dibuat ({file_size_kb:.2f} KB).")
    print(f"Input Name: 'float_input' [None, 16]")
    print(f"Output Name: 'variable' [None, 1]")

if __name__ == '__main__':
    convert_rf_to_onnx()
