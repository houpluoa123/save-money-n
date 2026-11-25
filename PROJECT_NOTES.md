# PROJECT_NOTES.md — Ví Tiết Kiệm Cá Nhân (VNĐ)

## Mục đích
Ứng dụng web quản lý tiết kiệm tiền cá nhân bằng tiếng Việt (đơn vị VNĐ), **không dùng `localStorage`/`sessionStorage`**, toàn bộ tài khoản, phân quyền, giao dịch tiết kiệm, mục tiêu, lịch sử hội thoại, cảnh báo an toàn chống lấy tiền và cấu hình AI/thông báo lưu tập trung trong cơ sở dữ liệu đám mây **Turso (`libsql`)** thông qua Backend API (`server.ts`).

## Công nghệ sử dụng
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide React, SVG Chart tùy biến (`GrowthChart.tsx`).
- **Backend & DB**: Node.js + Express (`server.ts`) kết nối Turso HTTP Pipeline (`/api/*`), mật khẩu mã hóa `scrypt`, phiên đăng nhập HMAC-SHA256 dùng cookie `HttpOnly` (`vtk_session`) để giữ đăng nhập khi tải lại trang mà không lưu xuống trình duyệt (`localStorage`/`sessionStorage`).
- **AI (Server-side only)**: Anthropic API (`claude-opus-5` mặc định cho chat), OpenAI-Compatible gateway, Google Gemini API (`@google/genai`), OpenAI API. Quét Camera AI hỗ trợ chế độ `auto` tự ưu tiên model nhận diện ảnh tốt nhất (tránh model chỉ xử lý chữ).
- **Kiểm thử**: `node:test` + `tsx` cho logic thuần túy; `playwright-cli` cho kiểm thử trình duyệt.

## Cấu trúc file và vai trò
- `server.ts`: Schema Turso (`app_users`, `user_transactions`, `user_goals`, `app_ai_settings`, `user_chat_messages`, `user_security_alerts`) + seed `admin`/`123456`; xác thực cookie `HttpOnly` & Bearer (`/api/auth/*`, `/api/public/login-notice`), giao dịch (`/api/transactions/*`), cảnh báo chống lấy tiền (`/api/security-alerts/*`), quét Camera AI (`/api/ai/scan-bill`), Trợ lý AI (`/api/advisor/*`), và quản trị có bảo vệ tài khoản quản trị gốc (`/api/admin/*`).
- `src/types/finance.ts`: `AuthUser` (`isRootAdmin`, `isLocked`, `canUseCamera`, `canUseChat`), `LoginNoticeConfig`, `SecurityAlert`, `DuplicateSerialInfo`, `AdminAISettings`.
- `src/utils/currency.ts`, `src/utils/serial.ts`, `src/utils/analytics.ts`, `src/utils/finance.test.ts`: Định dạng VNĐ, chuẩn hóa và phát hiện trùng seri, tính dòng tiền và kiểm tra sao lưu JSON.
- `src/App.tsx`: Khôi phục phiên từ `/api/auth/session` qua `HttpOnly` cookie khi reload (tránh lỗi 401 khi chưa đăng nhập), kiểm tra khóa tài khoản định kỳ qua `/api/auth/me` và hiển thị banner `Cảnh báo an toàn chống lấy tiền`.
- `src/components/LoginView.tsx` & `ForcePasswordModal.tsx`: Banner thông báo nhắc nhắn tin trực tiếp cho Admin qua link Discord gạch dưới; hiển thị cảnh báo bị khóa tài khoản; bắt buộc đổi mật khẩu 3 trường lần đầu.
- `src/components/DashboardView.tsx` & `GrowthChart.tsx`: Tổng số dư ròng VNĐ, tiến độ mục tiêu, KPI và biểu đồ tăng trưởng.
- `src/components/SavingsEntryView.tsx`: Nạp/rút VNĐ thủ công; quét Camera AI + cảnh báo đỏ trùng seri / xâm phạm quyền sở hữu.
- `src/components/HistoryView.tsx`: Tìm kiếm, lọc, sửa và xóa giao dịch trên DB.
- `src/components/AdvisorChatView.tsx`: Trợ lý AI Tài chính giới hạn phạm vi tài chính VNĐ.
- `src/components/SettingsView.tsx`: Đổi mật khẩu 3 trường, sao lưu/khôi phục JSON, xóa dữ liệu cá nhân.
- `src/components/AdminPanelView.tsx`: Quản lý tài khoản (bảo vệ `Quản trị gốc` không cho Admin phụ khóa/xóa/đặt lại MK), nút gạt quyền Camera/Chat, cấu hình AI + chọn model chụp ảnh `auto`/nhanh, và tùy chỉnh thông báo + link Discord màn hình đăng nhập.

## Quy ước & Ràng buộc
- Tuyệt đối không dùng `localStorage` hay `sessionStorage`; giữ phiên qua reload bằng `HttpOnly` cookie (`SameSite=None; Secure` trên HTTPS iframe / `SameSite=Lax` trên localhost).
- Tài khoản quản trị gốc (`admin`) được bảo vệ ở cả UI và Backend: các tài khoản admin tạo thêm không thể khóa, đổi quyền, đặt lại mật khẩu hoặc xóa tài khoản quản trị gốc.
- Tài khoản bị khóa nhận thông báo ngay khi đang đăng nhập (qua heartbeat `/api/auth/me` và HTTP 403 `ACCOUNT_LOCKED`) và khi đăng nhập đúng thông tin sẽ báo `"Tài khoản này đã bị khóa bởi quản trị viên."`.
- Cơ chế chống lấy tiền: Khi một tài khoản khác quét hoặc nhập tay trùng số seri đã có trong DB, hệ thống chặn giao dịch và tự động ghi/gửi `user_security_alerts` về tài khoản chủ sở hữu gốc.

## Lỗi đã sửa
- `src/App.tsx`: `aria-hidden="true"` trên icon props gây lỗi TS2769 → dùng `aria-hidden={true}`.
- `src/components/DashboardView.tsx`: Chuỗi `"350.000 ₫/lần"` bị ngắt dòng trước `₫` trên màn hình 390px → bọc `whitespace-nowrap`.
- `src/components/GrowthChart.tsx`: Ngày có rút tiền tạo chiều cao SVG `<rect height>` âm → dùng `Math.abs(pt.periodAmount)` và scale `minCumulative`.
- `server.ts`: Turso HTTP pipeline lỗi 400 (`invalid type: string "0.4", expected f64`) → chuyển `TursoArg` cho `float` nhận trực tiếp `number` (`f64`).
- `server.ts` & `src/components/AdminPanelView.tsx`: Xử lý quá tải `503 UNAVAILABLE`, loại bỏ model cũ `gemini-2.0-flash` (`404 NOT_FOUND`) thay bằng `gemini-3.8-flash` / `gemini-4-hydrogen` / `gemini-2.5-flash`, và hỗ trợ chế độ `auto` chọn model chụp ảnh tốt nhất.
- `server.ts` & `src/App.tsx`: Reload trang bị đăng xuất do chỉ giữ token trong RAM → bổ sung `HttpOnly` cookie `vtk_session` + `SESSION_SECRET` ổn định và `/api/auth/session` (trả `200 { authenticated: false }` khi chưa đăng nhập để không sinh lỗi console 401) khi khởi động mà không dùng `localStorage`.
