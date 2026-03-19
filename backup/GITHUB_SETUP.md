# Hướng dẫn Setup GitHub và Push Code

## ✅ Đã làm:
- ✅ Đổi branch `master` → `main`
- ✅ Remote đã được thêm: `https://github.com/chuotbinhba/tlcg-workflow.git`

## 🔐 Cần xác thực với GitHub

### Cách 1: Dùng Personal Access Token (Nhanh nhất)

#### Bước 1: Tạo Token trên GitHub

1. **Truy cập:** https://github.com/settings/tokens
2. **Click:** "Generate new token" → "Generate new token (classic)"
3. **Đặt tên:** `TLCG Workflow Deploy`
4. **Chọn quyền:**
   - ✅ `repo` (Full control of private repositories)
5. **Click:** "Generate token"
6. **Copy token** (chỉ hiện 1 lần!)

#### Bước 2: Push code với token

```bash
cd "/Volumes/MacEx01/TLCG Workflow"

# Khi được hỏi username: nhập GitHub username của bạn
# Khi được hỏi password: paste token (KHÔNG phải password GitHub)
git push -u origin main
```

**Hoặc dùng token trực tiếp trong URL:**

```bash
# Thay YOUR_TOKEN bằng token vừa tạo
git remote set-url origin https://YOUR_TOKEN@github.com/chuotbinhba/tlcg-workflow.git
git push -u origin main
```

### Cách 2: Dùng SSH (An toàn hơn, khuyến nghị)

#### Bước 1: Kiểm tra SSH key

```bash
ls -la ~/.ssh
```

Nếu thấy `id_rsa.pub` hoặc `id_ed25519.pub` → Đã có SSH key, skip Bước 2.

#### Bước 2: Tạo SSH key (nếu chưa có)

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# Nhấn Enter để chấp nhận default
# Nhấn Enter để không đặt passphrase (hoặc đặt nếu muốn)
```

#### Bước 3: Copy SSH key

```bash
cat ~/.ssh/id_ed25519.pub
# Hoặc nếu dùng RSA:
# cat ~/.ssh/id_rsa.pub
```

Copy toàn bộ output (bắt đầu với `ssh-ed25519` hoặc `ssh-rsa`)

#### Bước 4: Thêm SSH key vào GitHub

1. **Truy cập:** https://github.com/settings/keys
2. **Click:** "New SSH key"
3. **Title:** `MacBook Pro - TLCG Workflow`
4. **Key:** Paste SSH key vừa copy
5. **Click:** "Add SSH key"

#### Bước 5: Đổi remote sang SSH

```bash
cd "/Volumes/MacEx01/TLCG Workflow"
git remote set-url origin git@github.com:chuotbinhba/tlcg-workflow.git
git push -u origin main
```

## 🚀 Sau khi push thành công

### Connect với Netlify để auto-deploy:

1. **Truy cập:** https://app.netlify.com
2. **Add new site** → **Import from Git**
3. **Chọn GitHub** → Authorize nếu cần
4. **Chọn repo:** `chuotbinhba/tlcg-workflow`
5. **Deploy settings:**
   - Build command: (để trống)
   - Publish directory: `.` (root)
6. **Deploy site**

### Sau đó, mỗi lần cập nhật:

```bash
git add .
git commit -m "Update files"
git push
```

**Netlify sẽ tự động deploy!** 🎉

## 📝 Quick Commands

### Push code:
```bash
cd "/Volumes/MacEx01/TLCG Workflow"
git add .
git commit -m "updated"
git push
```

### Xem status:
```bash
git status
```

### Xem remote:
```bash
git remote -v
```

## ⚠️ Troubleshooting

### Lỗi: "Permission denied"
- Kiểm tra SSH key đã được thêm vào GitHub chưa
- Hoặc dùng Personal Access Token

### Lỗi: "Repository not found"
- Kiểm tra repo đã được tạo trên GitHub chưa
- Kiểm tra username/repo name đúng chưa

### Lỗi: "Authentication failed"
- Token có thể đã hết hạn, tạo token mới
- Hoặc kiểm tra SSH key

