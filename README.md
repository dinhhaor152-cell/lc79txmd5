# TOOL VIP VI LONG - SUPER AI LC79 V9.2

Backend dự đoán Tài Xỉu LC79 (lc79_hu & lc79_md5) — chạy trên Node.js + Express, sẵn sàng deploy lên Railway.

## Cấu trúc

```
.
├── server.js          # Express server + logic dự đoán (V3..V16, ensemble vote, đảo nhịp)
├── package.json
├── public/
│   └── index.html     # Giao diện god-pill (cùng origin với server)
├── Procfile
├── railway.json
└── .gitignore
```

## Endpoints

- `GET /predict/lc79_hu` — dự đoán phiên tới (Tài Xỉu Hủ)
- `GET /predict/lc79_md5` — dự đoán phiên tới (Tài Xỉu MD5)
- `GET /history/lc79_hu` — lịch sử dự đoán + tỉ lệ đúng
- `GET /history/lc79_md5`
- `GET /health`
- `GET /` — giao diện HTML

## Chạy local

```bash
npm install
npm start
# mở http://localhost:3000
```

## Push lên GitHub & Deploy Railway

1. Tạo repo mới trên GitHub.
2. Trong thư mục này:
   ```bash
   git init
   git add .
   git commit -m "init vi long ai v9.2"
   git branch -M main
   git remote add origin https://github.com/<USER>/<REPO>.git
   git push -u origin main
   ```
3. Vào https://railway.app → **New Project** → **Deploy from GitHub repo** → chọn repo vừa push.
4. Railway tự nhận diện Node.js, build và chạy `node server.js`. Không cần biến môi trường.
5. Sau khi deploy xong, vào **Settings → Networking → Generate Domain** để có URL public dạng `https://<ten>.up.railway.app`.

## Ghi chú

- Server tự fetch dữ liệu game mỗi 3 giây từ API Tele68.
- Lịch sử dự đoán được lưu trong RAM (mất khi restart). Muốn lâu dài có thể gắn DB sau.
- Logic dự đoán dịch trực tiếp từ userscript v9.2 (V3, V4, V5, V6, V7, V8, V11, V13, V14, V15, V16, ensemble vote, đảo nhịp 4 phiên, MD5 branch).
