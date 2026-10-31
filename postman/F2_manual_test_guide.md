# Bộ test tay — F2 Quản lý địa điểm (UC07 + UC08 + UC09)

Tài liệu dành cho test thủ công bằng Postman/Swagger. Mỗi case ghi rõ request, body và kết quả phải thấy.
Toàn bộ 42 case dưới đây phủ 44 test tự động (`F2LocationApiTests.java` 25 test cho UC07–UC08 và `F2PriceRuleApiTests.java` 19 test cho UC09), cộng vài case chỉ test tay được.

---

## 1. Chuẩn bị (3 bước)

**Bước 1 — Backend đang chạy**

```bash
curl http://localhost:8080/api/health
# Kỳ vọng: {"status":"UP"}
```

Nếu chưa chạy, mở terminal tại `E:\SEP490\backend`:

```bash
set DB_URL=jdbc:sqlserver://localhost:1433;databaseName=BMS;encrypt=true;trustServerCertificate=true
set DB_USERNAME=sa
set DB_PASSWORD=Bms@12345
mvnw spring-boot:run
```

**Bước 2 — Lấy token**

`POST http://localhost:8080/api/auth/login`

```json
{ "email": "owner1", "password": "Bms@12345" }
```

Copy giá trị `data.token` trong response. Token sống **24 giờ**.

**Bước 3 — Cấu hình Postman**

- Biến `baseUrl` = `http://localhost:8080`
- Header mặc định cho mọi request owner: `Authorization: Bearer <token>`
- Body: chọn **raw → JSON**

---

## 2. Tài khoản và dữ liệu seed

| Username | Mật khẩu | Role | Sở hữu |
|---|---|---|---|
| `owner1` | `Bms@12345` | OWNER | địa điểm **1** (Tân Bình), **2** (Thủ Đức) |
| `owner2` | `Bms@12345` | OWNER | địa điểm **3** (Bình Thạnh) |
| `admin` | `Bms@12345` | ADMIN | — |
| `staff1` | `Bms@12345` | STAFF | thuộc địa điểm 1 |
| `player1` | `Bms@12345` | PLAYER | — |

Dữ liệu gốc của địa điểm 1: **3 sân** (`Sân 1`, `Sân 2`, `Sân 3`), **7/7 ngày** mở `06:00–23:30`, **0** ngày ngoại lệ, `advanceBookingDays = 30`.

---

## 3. Ba lưu ý bắt buộc — đọc trước khi test

1. **Header `X-Location-Id`** bắt buộc với các API `/api/owner/**` mà path **không chứa** id địa điểm:
   - `PATCH /api/owner/courts/{id}`
   - `PATCH|DELETE /api/owner/opening-exceptions/{id}`
   - `GET|POST|PATCH|DELETE /api/owner/courts/{id}/price-rules` và `/api/owner/price-rules/{id}`
   - `GET|POST|PATCH|DELETE /api/owner/batch-offers`

   Thiếu header → **401** (không phải lỗi token).

2. **Mọi lỗi quyền đang trả 401 thay vì 403** — đây là bug có sẵn của F1 (`SecurityConfig` thiếu `permitAll` cho `/error`), chưa được sửa vì không thuộc phạm vi F2. Khi thấy 401 ở case "sai quyền", hiểu là **đúng hiện trạng**, không phải token hết hạn.

3. **Địa điểm bị khoá (LOCKED)** bị `LocationScopeFilter` chặn ở mọi API, kể cả GET. Muốn test trạng thái khoá phải UPDATE DB trực tiếp.

---

# PHẦN A — UC07: Địa điểm và sân (10 case)

### TC-01 · Owner chỉ thấy địa điểm của mình

```
GET {{baseUrl}}/api/owner/locations
Authorization: Bearer <token owner1>
```

**Kỳ vọng:** `200`

**Kiểm tra:**
- `success = true`
- `data` có đúng **2** phần tử
- Chỉ có `id=1` "Sân cầu lông Tân Bình" và `id=2` "Sân cầu lông Thủ Đức"
- **Không** có "Sân cầu lông Bình Thạnh" (của owner2)
- Mỗi phần tử có `bankName`, `bankAccountNo`, `advanceBookingDays`, `pointEarningRate`, `status`

---

### TC-02 · Xem sân của địa điểm

```
GET {{baseUrl}}/api/owner/locations/1/courts
Authorization: Bearer <token owner1>
```

**Kỳ vọng:** `200`, `data` có **3** phần tử: `Sân 1`, `Sân 2`, `Sân 3`, tất cả `active = true`.

---

### TC-03 · Thêm sân mới

```
POST {{baseUrl}}/api/owner/locations/1/courts
Authorization: Bearer <token owner1>
Content-Type: application/json
```

```json
{ "name": "Sân Test 01", "description": "Sân thảm trong nhà" }
```

**Kỳ vọng:** **`201`**

**Kiểm tra:**
- `data.name = "Sân Test 01"`
- `data.active = true` (mặc định bật)
- `data.locationId = 1`
- `data.id` mới — **ghi lại id này**, dùng cho TC-06

---

### TC-04 · Không cho trùng tên sân (không phân biệt hoa/thường)

```
POST {{baseUrl}}/api/owner/locations/1/courts
```

```json
{ "name": "sân test 01" }
```

**Kỳ vọng:** **`400`**

`message` = `"Tên sân đã tồn tại trong địa điểm này"`

> Đây là điểm dễ sai nhất: `"sân test 01"` viết thường vẫn phải bị chặn.

---

### TC-05 · Cùng tên sân ở địa điểm khác thì hợp lệ

```
POST {{baseUrl}}/api/owner/locations/3/courts
Authorization: Bearer <token owner2>
```

```json
{ "name": "Sân 1" }
```

**Kỳ vọng:** **`201`** — trùng tên với sân của địa điểm 1 nhưng khác địa điểm nên hợp lệ.

> Test này chứng minh ràng buộc đúng phạm vi: chỉ chặn trùng **trong cùng địa điểm**.

---

### TC-06 · Sửa tên và tạm ngưng sân

```
PATCH {{baseUrl}}/api/owner/courts/<id của TC-03>
Authorization: Bearer <token owner1>
X-Location-Id: 1
Content-Type: application/json
```

```json
{ "name": "Sân Test 01 (sửa)", "isActive": false }
```

**Kỳ vọng:** `200`, `data.name = "Sân Test 01 (sửa)"`, `data.active = false`.

**Thử thêm:** bỏ header `X-Location-Id` → phải ra **401**.

---

### TC-07 · Cập nhật địa điểm — chỉ đổi trường gửi lên

```
PATCH {{baseUrl}}/api/owner/locations/1
Authorization: Bearer <token owner1>
Content-Type: application/json
```

```json
{ "advanceBookingDays": 45, "contactPhone": "0912345678" }
```

**Kỳ vọng:** `200`

**Kiểm tra:**
- `advanceBookingDays = 45`
- `contactPhone = "0912345678"`
- `name` **vẫn là** "Sân cầu lông Tân Bình" (không bị ghi đè thành null)
- `bankName` vẫn là `Vietcombank`

---

### TC-08 · Số điện thoại sai định dạng

```
PATCH {{baseUrl}}/api/owner/locations/1
```

```json
{ "contactPhone": "123" }
```

**Kỳ vọng:** **`400`**, `success = false`, có `errors.contactPhone`.

---

### TC-09 · Số ngày đặt trước ngoài khoảng cho phép

```
PATCH {{baseUrl}}/api/owner/locations/1
```

```json
{ "advanceBookingDays": 0 }
```

**Kỳ vọng:** **`400`**, có `errors.advanceBookingDays` (min = 1).

**Thử thêm:** `{ "advanceBookingDays": 500 }` → 400 (max = 365).

---

### TC-10 · Danh sách sân đã có sân mới

```
GET {{baseUrl}}/api/owner/locations/1/courts
```

**Kỳ vọng:** `200`, **4** phần tử (3 sân seed + "Sân Test 01 (sửa)").

---

# PHẦN B — UC08: Giờ mở cửa (9 case)

### TC-11 · Luôn trả đủ 7 ngày

```
GET {{baseUrl}}/api/owner/locations/1/opening-hours
```

**Kỳ vọng:** `200`, `data` có đúng **7** phần tử.

**Kiểm tra phần tử đầu:**
```json
{
  "dayOfWeek": 1,
  "dayName": "Thứ 2",
  "openMinute": 360,
  "closeMinute": 1410,
  "openTime": "06:00",
  "closeTime": "23:30",
  "durationMinutes": 1050,
  "configured": true
}
```

Phần tử cuối `dayOfWeek = 7`, `dayName = "Chủ nhật"`.

---

### TC-12 · Cập nhật cả tuần bằng số phút

```
PUT {{baseUrl}}/api/owner/locations/1/opening-hours
Content-Type: application/json
```

```json
{
  "hours": [
    { "dayOfWeek": 1, "openMinute": 360,  "closeMinute": 1410 },
    { "dayOfWeek": 2, "openMinute": 360,  "closeMinute": 1410 },
    { "dayOfWeek": 3, "openMinute": 330,  "closeMinute": 1380 },
    { "dayOfWeek": 4, "openMinute": 330,  "closeMinute": 1380 },
    { "dayOfWeek": 5, "openMinute": 360,  "closeMinute": 1440 },
    { "dayOfWeek": 6, "openMinute": 420,  "closeMinute": 1080 },
    { "dayOfWeek": 7, "openMinute": 480,  "closeMinute": 1200 }
  ]
}
```

**Kỳ vọng:** `200`

**Kiểm tra:**
- `data` có 7 phần tử, **tất cả** `configured = true`
- `data[2].openTime = "05:30"` (từ `330`)
- `data[4].closeTime = "24:00"` (từ `1440`)
- `data[6].durationMinutes = 720` (từ `480 → 1200`)

---

### TC-13 · Thay thế toàn phần — ngày không gửi bị xoá

```
PUT {{baseUrl}}/api/owner/locations/1/opening-hours
```

```json
{ "hours": [ { "dayOfWeek": 2, "openMinute": 360, "closeMinute": 1320 } ] }
```

**Kỳ vọng:** `200`

**Kiểm tra:** `data` vẫn đủ 7 phần tử nhưng **chỉ `data[1]` (Thứ 3)** có `configured = true`; 6 ngày còn lại `configured = false`, `openTime = null`.

> Đây là điểm khác biệt quan trọng: PUT là **thay thế**, không phải cập nhật từng phần.

---

### TC-14 · Nhận cả chuỗi "HH:mm"

```
PUT {{baseUrl}}/api/owner/locations/1/opening-hours
```

```json
{
  "hours": [
    { "dayOfWeek": 3, "openTime": "07:30", "closeTime": "24:00" },
    { "dayOfWeek": 4, "openTime": "06:00", "closeTime": "22:00" }
  ]
}
```

**Kỳ vọng:** `200`, `data[2].openTime = "07:30"`, `data[2].closeTime = "24:00"`.

---

### TC-15 · Giờ đóng phải sau giờ mở

```
PUT {{baseUrl}}/api/owner/locations/1/opening-hours
```

```json
{ "hours": [ { "dayOfWeek": 1, "openMinute": 600, "closeMinute": 540 } ] }
```

**Kỳ vọng:** **`400`**, `message = "Giờ đóng cửa phải sau giờ mở cửa"`.

**Thử thêm:** `openMinute = 600, closeMinute = 600` → cũng 400.

---

### TC-16 · Phút phải là bội số của 30

```
PUT {{baseUrl}}/api/owner/locations/1/opening-hours
```

```json
{ "hours": [ { "dayOfWeek": 1, "openMinute": 365, "closeMinute": 600 } ] }
```

**Kỳ vọng:** **`400`**, `message = "Giờ mở cửa phải là bội số của 30 phút"`.

---

### TC-17 · Không cho gửi trùng thứ

```
PUT {{baseUrl}}/api/owner/locations/1/opening-hours
```

```json
{
  "hours": [
    { "dayOfWeek": 1, "openMinute": 360, "closeMinute": 600 },
    { "dayOfWeek": 1, "openMinute": 360, "closeMinute": 660 }
  ]
}
```

**Kỳ vọng:** **`400`**, `message = "Thứ 1 bị gửi trùng trong yêu cầu"`.

---

### TC-18 · Danh sách rỗng

```
PUT {{baseUrl}}/api/owner/locations/1/opening-hours
```

```json
{ "hours": [] }
```

**Kỳ vọng:** **`400`**, `errors.hours = "Phải cấu hình ít nhất một ngày mở cửa"`.

---

### TC-19 · Thứ ngoài khoảng 1–7

```
PUT {{baseUrl}}/api/owner/locations/1/opening-hours
```

```json
{ "hours": [ { "dayOfWeek": 9, "openMinute": 360, "closeMinute": 600 } ] }
```

**Kỳ vọng:** **`400`**, `errors["hours[0].dayOfWeek"]` = "Thứ trong tuần lớn nhất là 7 (Chủ nhật)".

---

# PHẦN C — UC08: Ngày ngoại lệ (7 case)

### TC-20 · Danh sách ngoại lệ ban đầu

```
GET {{baseUrl}}/api/owner/locations/1/opening-exceptions
```

**Kỳ vọng:** `200`, `data` là mảng — ban đầu rỗng `[]`.

---

### TC-21 · Tạo ngày ngoại lệ

```
POST {{baseUrl}}/api/owner/locations/1/opening-exceptions
Content-Type: application/json
```

```json
{
  "exceptionDate": "2026-12-20",
  "openTime": "08:00",
  "closeTime": "12:00",
  "note": "Bảo trì sân"
}
```

**Kỳ vọng:** **`201`**

**Kiểm tra:**
- `data.exceptionDate = "2026-12-20"`
- `data.openTime = "08:00"`, `data.closeTime = "12:00"`
- `data.durationMinutes = 240`
- `data.note = "Bảo trì sân"`
- `data.locationId = 1`

**Ghi lại `data.id`** để dùng cho TC-25, TC-26.

---

### TC-22 · Không cho trùng ngày

```
POST {{baseUrl}}/api/owner/locations/1/opening-exceptions
```

```json
{ "exceptionDate": "2026-12-20", "openMinute": 600, "closeMinute": 780 }
```

**Kỳ vọng:** **`400`**, `message = "Ngày 2026-12-20 đã có cấu hình ngoại lệ cho địa điểm này"`.

---

### TC-23 · Bắt buộc có ngày

```
POST {{baseUrl}}/api/owner/locations/1/opening-exceptions
```

```json
{ "openMinute": 480, "closeMinute": 720 }
```

**Kỳ vọng:** **`400`**, `errors.exceptionDate = "Ngày ngoại lệ không được để trống"`.

---

### TC-24 · Lọc theo khoảng ngày

Tạo thêm 1 ngoại lệ ngày `2027-01-15` (giờ bất kỳ), sau đó:

```
GET {{baseUrl}}/api/owner/locations/1/opening-exceptions?from=2027-01-01
```

**Kỳ vọng:** `200`, chỉ trả **1** phần tử (ngày `2027-01-15`), không có `2026-12-20`.

**Thử thêm:** `?from=2027-02-01&to=2027-01-01` → **400** "Ngày bắt đầu lọc không được sau ngày kết thúc".

---

### TC-25 · Sửa ngày ngoại lệ

```
PATCH {{baseUrl}}/api/owner/opening-exceptions/<id của TC-21>
Authorization: Bearer <token owner1>
X-Location-Id: 1
Content-Type: application/json
```

```json
{ "closeMinute": 780, "note": "Sửa giờ đóng" }
```

**Kỳ vọng:** `200`

**Kiểm tra:** `data.closeTime = "13:00"`, `data.note = "Sửa giờ đóng"`, `data.exceptionDate` **vẫn là** `2026-12-20` (không đổi).

**Thử thêm:** `{ "openMinute": 1320 }` khi `closeMinute = 780` → **400** (giờ mở vượt giờ đóng).

---

### TC-26 · Xoá và xoá lại

```
DELETE {{baseUrl}}/api/owner/opening-exceptions/<id của TC-21>
X-Location-Id: 1
```

**Kỳ vọng lần 1:** `200`, `message = "Đã xoá ngày ngoại lệ"`

**Kỳ vọng lần 2:** **`404`**, `message = "Không tìm thấy ngày ngoại lệ"`

---

# PHẦN D — Phân quyền (3 case)

> Cả 3 case dưới đây trả **401** thay vì 403 do bug F1. Ghi nhận đúng hiện trạng, không phải lỗi F2.

### TC-27 · PLAYER gọi API owner

```
GET {{baseUrl}}/api/owner/locations
Authorization: Bearer <token player1>
```

**Kỳ vọng:** **`401`** (đúng ra 403), body trống.

---

### TC-28 · Owner xem địa điểm của owner khác

```
GET {{baseUrl}}/api/owner/locations/3/courts
Authorization: Bearer <token owner1>
```

**Kỳ vọng:** **`401`** (đúng ra 403) — không được trả dữ liệu sân của địa điểm 3.

---

### TC-29 · Không gửi token

```
GET {{baseUrl}}/api/owner/locations
```

**Kỳ vọng:** **`401`**, body trống.

---

## 3b. UC09 — Bảng giá và ưu đãi đặt theo lô

Dữ liệu gốc: mỗi sân có **3 dòng giá** (T2–T6 `06:00–17:00` = 60.000đ, T2–T6 `17:00–23:30` = 90.000đ, T7–CN `06:00–23:30` = 100.000đ). Vì vậy khung giờ **đã bị phủ kín**, muốn tạo dòng giá mới hợp lệ phải chọn ngày/giờ chưa có hoặc dùng khoảng hiệu lực khác (ví dụ năm 2025).

Voucher mẫu để test ưu đãi: `BATCH10` (id 1) và `BATCH50K` (id 2) thuộc **địa điểm 1**, trạng thái `PUBLISHED`.

---

### TC-30 · Xem bảng giá của sân

```
GET {{baseUrl}}/api/owner/courts/1/price-rules
Authorization: Bearer <token owner1>
X-Location-Id: 1
```

**Kỳ vọng:** **`200`**, `data` có 3 phần tử; mỗi phần tử có `applyDays` 7 ký tự, `dayLabels` tiếng Việt (`"Thứ 2"`), `startTime`/`endTime` dạng `HH:mm`, `active: true`.

---

### TC-31 · Thêm dòng giá hợp lệ

```
POST {{baseUrl}}/api/owner/courts/1/price-rules
Authorization: Bearer <token owner1>
X-Location-Id: 1

{
  "days": [1,2,3,4,5],
  "startTime": "17:00",
  "endTime": "22:00",
  "pricePerSlot": 90000,
  "validFrom": "2025-01-01",
  "validTo": "2025-12-31"
}
```

**Kỳ vọng:** **`201`**, `data.applyDays = "1111100"`, `data.days = [1,2,3,4,5]`, `data.durationMinutes = 300`.

---

### TC-32 · Trùng khung giờ của cùng một sân

```
POST {{baseUrl}}/api/owner/courts/1/price-rules
Authorization: Bearer <token owner1>
X-Location-Id: 1

{ "days": [3], "startTime": "18:00", "endTime": "20:00", "pricePerSlot": 100000, "validFrom": "2025-06-01" }
```

**Kỳ vọng:** **`409`**, message `Bảng giá bị trùng với quy tắc #<id> (...)`.

---

### TC-33 · Giờ lẻ không phải bội số 30 phút

```
POST {{baseUrl}}/api/owner/courts/1/price-rules
Authorization: Bearer <token owner1>
X-Location-Id: 1

{ "days": [6], "startTime": "17:15", "endTime": "18:00", "pricePerSlot": 80000, "validFrom": "2026-11-01" }
```

**Kỳ vọng:** **`400`**, message `Giờ bắt đầu phải là bội số của 30 phút`.

---

### TC-34 · Không chọn thứ nào

```
POST {{baseUrl}}/api/owner/courts/1/price-rules
Authorization: Bearer <token owner1>
X-Location-Id: 1

{ "days": [], "startTime": "17:00", "endTime": "18:00", "pricePerSlot": 80000, "validFrom": "2026-11-01" }
```

**Kỳ vọng:** **`400`**, `errors.days = "Phải chọn ít nhất một ngày áp dụng giá"`.

---

### TC-35 · Sửa giá — chỉ đổi trường gửi lên

```
PATCH {{baseUrl}}/api/owner/price-rules/19
Authorization: Bearer <token owner1>
X-Location-Id: 1

{ "pricePerSlot": 95000 }
```

**Kỳ vọng:** **`200`**, `pricePerSlot = 95000`, `applyDays`/`startMinute`/`validFrom` giữ nguyên.

---

### TC-36 · Xoá dòng giá rồi xoá lại

```
DELETE {{baseUrl}}/api/owner/price-rules/19
Authorization: Bearer <token owner1>
X-Location-Id: 1
```

**Kỳ vọng:** lần 1 **`200`** (`Đã xoá quy tắc giá`), lần 2 **`404`** (`Không tìm thấy quy tắc giá`).

---

### TC-37 · Danh sách ưu đãi theo lô

```
GET {{baseUrl}}/api/owner/batch-offers
Authorization: Bearer <token owner1>
X-Location-Id: 1
```

**Kỳ vọng:** **`200`**, `data[0].voucherCode = "BATCH10"`, `discountType = "PERCENT"`, `voucherStatus = "PUBLISHED"`, `active` phản ánh hôm nay có nằm trong `startDate–endDate` hay không.

---

### TC-38 · Tạo ưu đãi đặt theo lô

```
POST {{baseUrl}}/api/owner/batch-offers
Authorization: Bearer <token owner1>
X-Location-Id: 1

{ "name": "Ưu đãi đặt lô tháng 11", "startDate": "2026-11-01", "endDate": "2026-11-30", "minPackageAmount": 500000, "voucherId": 1 }
```

**Kỳ vọng:** **`201`**, `data.voucherId = 1`, `data.minPackageAmount = 500000`.

---

### TC-39 · Voucher thuộc địa điểm khác

```
POST {{baseUrl}}/api/owner/batch-offers
Authorization: Bearer <token owner1>
X-Location-Id: 1

{ "name": "Sai voucher", "startDate": "2026-11-01", "endDate": "2026-11-30", "minPackageAmount": 500000, "voucherId": 3 }
```

**Kỳ vọng:** **`400`**, message `Voucher không thuộc địa điểm này` (voucher id 3 thuộc địa điểm 3).

---

### TC-40 · Ngày kết thúc trước ngày bắt đầu

```
POST {{baseUrl}}/api/owner/batch-offers
Authorization: Bearer <token owner1>
X-Location-Id: 1

{ "name": "Sai ngày", "startDate": "2026-11-30", "endDate": "2026-11-01", "minPackageAmount": 500000, "voucherId": 1 }
```

**Kỳ vọng:** **`400`**, message `Ngày kết thúc phải sau hoặc bằng ngày bắt đầu`.

---

### TC-41 · Sửa và xoá ưu đãi

```
PATCH {{baseUrl}}/api/owner/batch-offers/2
Authorization: Bearer <token owner1>
X-Location-Id: 1

{ "minPackageAmount": 800000 }
```

**Kỳ vọng:** **`200`**, `minPackageAmount = 800000`. Sau đó `DELETE` cùng URL → **`200`**, gọi lại → **`404`**.

---

### TC-42 · Thiếu header X-Location-Id ở API ưu đãi

```
GET {{baseUrl}}/api/owner/batch-offers
Authorization: Bearer <token owner1>
```

**Kỳ vọng:** **`401`** (đúng ra 400 — cùng lỗi `sendError` của F1 đã ghi ở mục 3), body trống.

---

## 4. Bảng ghi kết quả

| TC | Nội dung | Kỳ vọng | Thực tế | Đạt |
|---|---|---|---|---|
| 01 | Owner chỉ thấy địa điểm của mình | 200, 2 địa điểm | | ☐ |
| 02 | Xem sân của địa điểm | 200, 3 sân | | ☐ |
| 03 | Thêm sân mới | 201 | | ☐ |
| 04 | Trùng tên sân (khác hoa/thường) | 400 | | ☐ |
| 05 | Cùng tên sân khác địa điểm | 201 | | ☐ |
| 06 | Sửa tên + tạm ngưng sân | 200 | | ☐ |
| 07 | Cập nhật địa điểm từng phần | 200 | | ☐ |
| 08 | SĐT sai định dạng | 400 | | ☐ |
| 09 | advanceBookingDays ngoài khoảng | 400 | | ☐ |
| 10 | Danh sách sân sau khi thêm | 200, 4 sân | | ☐ |
| 11 | Luôn trả đủ 7 ngày | 200, 7 ngày | | ☐ |
| 12 | PUT cả tuần bằng phút | 200, 7/7 | | ☐ |
| 13 | PUT thay thế toàn phần | 200, 1/7 | | ☐ |
| 14 | Nhận chuỗi "HH:mm" | 200 | | ☐ |
| 15 | Đóng trước mở | 400 | | ☐ |
| 16 | Phút lẻ | 400 | | ☐ |
| 17 | Trùng thứ | 400 | | ☐ |
| 18 | Danh sách rỗng | 400 | | ☐ |
| 19 | Thứ = 9 | 400 | | ☐ |
| 20 | Danh sách ngoại lệ | 200, [] | | ☐ |
| 21 | Tạo ngoại lệ | 201 | | ☐ |
| 22 | Trùng ngày ngoại lệ | 400 | | ☐ |
| 23 | Thiếu ngày | 400 | | ☐ |
| 24 | Lọc theo from | 200, 1 bản ghi | | ☐ |
| 25 | Sửa ngoại lệ | 200 | | ☐ |
| 26 | Xoá rồi xoá lại | 200 → 404 | | ☐ |
| 27 | PLAYER gọi API owner | 401 | | ☐ |
| 28 | Chéo chủ địa điểm | 401 | | ☐ |
| 29 | Không token | 401 | | ☐ |
| 30 | Xem bảng giá của sân | 200, 3 dòng | | ☐ |
| 31 | Thêm dòng giá hợp lệ | 201 | | ☐ |
| 32 | Trùng khung giờ | 409 | | ☐ |
| 33 | Giờ lẻ 15 phút | 400 | | ☐ |
| 34 | Không chọn thứ | 400 | | ☐ |
| 35 | PATCH chỉ đổi giá | 200 | | ☐ |
| 36 | Xoá dòng giá rồi xoá lại | 200 → 404 | | ☐ |
| 37 | Danh sách ưu đãi theo lô | 200, có voucherCode | | ☐ |
| 38 | Tạo ưu đãi theo lô | 201 | | ☐ |
| 39 | Voucher khác địa điểm | 400 | | ☐ |
| 40 | Ngày kết thúc trước bắt đầu | 400 | | ☐ |
| 41 | Sửa + xoá ưu đãi | 200 → 200 → 404 | | ☐ |
| 42 | Thiếu X-Location-Id (ưu đãi) | 401 | | ☐ |

---

## 5. Lỗi thường gặp khi test

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Mọi request 401, body trống | Chưa gắn token, hoặc biến `token` rỗng | Chạy lại login, dán token vào header |
| 401 dù đã có token | Thiếu `X-Location-Id` ở 3 API đã nêu | Thêm header `X-Location-Id: 1` |
| 403 mong đợi nhưng thấy 401 | Bug F1 chưa sửa | Đúng hiện trạng, ghi nhận |
| 400 "Tên sân đã tồn tại" khi tên có vẻ mới | So sánh không phân biệt hoa/thường | Đổi tên khác hẳn |
| 400 "đã có cấu hình ngoại lệ" | Ngày đó đã có ngoại lệ từ lần test trước | Đổi ngày, hoặc xoá ngoại lệ cũ |
| 409 "Bảng giá bị trùng với quy tắc #…" | Khung giờ + thứ + khoảng ngày đã có dòng giá khác | Đổi giờ/thứ, hoặc dùng `validFrom`/`validTo` khác |
| 400 "Voucher không thuộc địa điểm này" | `voucherId` thuộc địa điểm khác với `X-Location-Id` | Dùng voucher 1 hoặc 2 (địa điểm 1) |
| 400 "Voucher phải ở trạng thái PUBLISHED" | Voucher còn `DRAFT`/`DISABLED` | Phát hành voucher trước (F6/UC24) |
| 500 khi PUT giờ mở cửa | Gửi phút lẻ hoặc `close <= open` lọt qua validate | Kiểm tra lại body |

---

## 6. Reset dữ liệu về ban đầu

Sau khi test sẽ có sân/ngoại lệ rác. Xoá bằng SQL Server Management Studio:

```sql
USE BMS;

-- Xoá sân tạo trong lúc test
DELETE FROM dbo.court WHERE name LIKE N'Sân Test%' OR name LIKE N'Sân A%';

-- Xoá toàn bộ ngày ngoại lệ (test tạo ra)
DELETE FROM dbo.opening_exception;

-- Trả giờ mở cửa địa điểm 1 về 06:00 - 23:30 cả tuần
DELETE FROM dbo.opening_hour WHERE location_id = 1;
INSERT INTO dbo.opening_hour (location_id, day_of_week, open_minute, close_minute)
SELECT 1, d, 360, 1410 FROM (VALUES (1),(2),(3),(4),(5),(6),(7)) AS t(d);

-- Xoá dòng giá và ưu đãi tạo trong lúc test (giữ 18 dòng giá seed)
DELETE FROM dbo.price_rule WHERE court_id NOT IN (1,2,3,4,5,6) OR id > 18;
DELETE FROM dbo.batch_offer WHERE name <> N'Ưu đãi đặt lô tháng 11';

-- Kiểm tra lại
SELECT (SELECT COUNT(*) FROM dbo.court) AS courts,
       (SELECT COUNT(*) FROM dbo.opening_hour) AS hours,
       (SELECT COUNT(*) FROM dbo.opening_exception) AS exceptions,
       (SELECT COUNT(*) FROM dbo.price_rule) AS price_rules,
       (SELECT COUNT(*) FROM dbo.batch_offer) AS batch_offers;
-- Kỳ vọng: 6 | 21 | 0 | 18 | 1
```

Nếu muốn reset toàn bộ về seed gốc: xoá database `BMS` rồi chạy lại `BMS_database.sql` và `BMS_seed_dev.sql`.

---

## 7. Chạy lại bộ test tự động (nhanh hơn 42 case tay)

```bash
cd E:\SEP490\backend
set DB_URL=jdbc:sqlserver://localhost:1433;databaseName=BMS;encrypt=true;trustServerCertificate=true
set DB_USERNAME=sa
set DB_PASSWORD=Bms@12345
mvnw test -Dtest="F2LocationApiTests,F2PriceRuleApiTests"
```

Kỳ vọng: `Tests run: 44, Failures: 0, Errors: 0`.

Hoặc chạy Postman collection (53 assertion):

```bash
cd E:\SEP490\postman
npx --yes newman run BMS_F2.postman_collection.json ^
  --folder "00 - Auth (chạy trước)" ^
  --folder "F2 - UC07 Địa điểm & sân (OWNER)" ^
  --folder "F2 - UC08 Giờ mở cửa & ngày ngoại lệ (OWNER)" ^
  --folder "F2 - UC09 Bảng giá & ưu đãi theo lô (OWNER)" --reporters cli
```
