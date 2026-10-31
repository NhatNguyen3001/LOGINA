# Chính sách quyền riêng tư của LOGINA

**Phiên bản:** 0.3 (bản nháp, luật sư chưa rà soát) · **Cập nhật:** 31/10/2026 · **Liên hệ:** logina.edu@gmail.com

## 1. Chúng tôi là ai
LOGINA giúp giáo viên biến học liệu của mình thành các nhiệm vụ suy luận. Nhóm LOGINA vận hành dịch vụ. Mọi câu hỏi xin gửi về **logina.edu@gmail.com**.

Bản trình diễn không có tài khoản, và mỗi trình duyệt có một không gian làm việc riêng. Tên trong bài mẫu là hư cấu. Hiện chưa có lớp học thật nào dùng LOGINA. Khi dùng ở trường, **nhà trường quyết định việc sử dụng dữ liệu của học sinh**, theo thỏa thuận xử lý dữ liệu được ký trước khi thí điểm.

## 2. Dữ liệu chúng tôi thu thập
| Loại dữ liệu | Ví dụ | Của ai |
|---|---|---|
| Phiên ẩn danh | Mã ngẫu nhiên cho mỗi trình duyệt, không gắn với tên hay email | Mọi người dùng |
| Tài khoản (không có trong bản trình diễn) | Họ tên, email, vai trò, lớp, trường | Giáo viên, học sinh |
| Học liệu và bài soạn | Tệp tải lên, nội dung AI đọc được, quyết định của giáo viên, nhiệm vụ đã duyệt | Giáo viên |
| Bài làm | Lựa chọn, mức tự tin và thời gian trước và sau câu “Thử nghĩ thêm” | Học sinh |
| Đồng ý nghiên cứu | Lựa chọn của bạn, phiên bản văn bản và thời điểm | Học sinh, người dùng bản trình diễn |
| Dữ liệu nghiên cứu | Mỗi nhiệm vụ một dòng: mã người tham gia, câu trả lời, mức tự tin, thời gian, ngôn ngữ, bài viết Q5 nguyên văn. Chỉ ghi khi bạn đồng ý | Người tham gia đã đồng ý |
| Hoạt động của giáo viên | Duyệt, sửa, giao bài, chấp nhận cảnh báo | Giáo viên |
| Nhật ký kỹ thuật | Địa chỉ IP, trình duyệt, thời gian truy cập, lỗi | Mọi người dùng |

Bản trình diễn không hỏi tên, email hay tuổi của bạn. Xin đừng gõ thông tin cá nhân vào Q5 hoặc tải lên tệp chứa thông tin đó. Chúng tôi không thu thập vị trí, danh bạ, ảnh hay dữ liệu sinh trắc học, và không dùng công cụ phân tích, theo dõi hay quảng cáo của bên thứ ba.

## 3. Chúng tôi dùng dữ liệu để làm gì
- Vận hành LOGINA: soạn, duyệt, giao và làm nhiệm vụ.
- Cho giáo viên xem lựa chọn của học sinh và thống kê của lớp.
- Giữ an toàn hệ thống và sửa lỗi.
- Nghiên cứu, chỉ khi bạn đồng ý: dữ liệu được chép vào một Google Sheet mà nhóm đọc và có thể xuất hiện trong một bài báo, chỉ mô tả theo nhóm.

LOGINA không chấm điểm, không xếp hạng học sinh, không bán dữ liệu và không chia sẻ dữ liệu cho quảng cáo.

## 4. Trí tuệ nhân tạo (AI)
Gemini trên Google Cloud Vertex AI đọc tệp của giáo viên, soạn nháp nhiệm vụ và kiểm tra logic. **Bài làm của học sinh không được gửi tới AI.** Câu “Thử nghĩ thêm” do giáo viên duyệt trước và được chọn bằng quy tắc cố định. Theo điều khoản của Google Cloud, dữ liệu này không được dùng để huấn luyện mô hình của Google.

## 5. Lưu trữ trên trình duyệt
| Lưu gì | Ở đâu | Để làm gì |
|---|---|---|
| Phiên ẩn danh | IndexedDB | Giữ không gian làm việc riêng của bạn. Trình duyệt mới hoặc xóa dữ liệu trang sẽ tạo không gian mới |
| Đã xem hướng dẫn demo | localStorage | Để hướng dẫn không hiện lại |

Không có cookie quảng cáo, phân tích hay của bên thứ ba, nên LOGINA không hiển thị hộp chọn cookie.

## 6. Nơi lưu trữ
Dữ liệu được lưu trên Google Cloud tại **Singapore**. Phiên, yêu cầu AI, nhật ký kỹ thuật và Google Sheet nghiên cứu có thể nằm ở các trung tâm dữ liệu khác của Google, nên dữ liệu có thể ra ngoài Việt Nam. Trước khi thí điểm với học sinh thật, chúng tôi sẽ hoàn thành thủ tục theo Luật Bảo vệ dữ liệu cá nhân và Nghị định 356/2025.

## 7. Ai được xem dữ liệu
- **Học sinh:** bài làm của chính mình, và kết quả sau khi hoàn thành.
- **Giáo viên:** bài làm trong lớp mình. Trong bản trình diễn, trình duyệt khác không thấy bài của bạn.
- **Nhóm LOGINA:** chỉ để vận hành, sửa lỗi hoặc đọc Google Sheet nghiên cứu.
- **Google Cloud và Firebase:** theo điều khoản xử lý dữ liệu của Google.
- **Cơ quan nhà nước:** khi pháp luật yêu cầu.

## 8. Lưu trữ bao lâu
- Không gian trình diễn: xóa sau cuộc thi. “Đặt lại demo” xóa tệp tải lên sớm hơn.
- Dữ liệu nghiên cứu: đến khi bài báo được công bố, tối đa 2 năm.
- Thí điểm: thống nhất với từng trường.
- Nhật ký kỹ thuật: khoảng 30 ngày.

## 9. Trẻ em
LOGINA dành cho học sinh trung học phổ thông. Học sinh dưới 16 tuổi cần có sự đồng ý của cha mẹ hoặc người giám hộ, và nhà trường xác nhận việc này trước khi tạo lớp.

## 10. Quyền của bạn
Bạn có thể xem, sửa, xóa dữ liệu của mình, rút lại sự đồng ý, phản đối việc xử lý, hoặc khiếu nại tới cơ quan có thẩm quyền. Hãy gửi về **logina.edu@gmail.com**; học sinh có thể nhờ giáo viên hoặc cha mẹ giúp. **Để rút khỏi nghiên cứu,** hãy gửi mã người tham gia của bạn. Vì không biết tên bạn, chúng tôi chỉ tìm được dữ liệu qua mã này.

## 11. Bảo mật
Dữ liệu được mã hóa khi truyền và khi lưu, và mỗi vai trò chỉ nhận đúng dữ liệu cần thiết. Đáp án chỉ nằm trên máy chủ. Nếu xảy ra sự cố, chúng tôi sẽ thông báo theo quy định của pháp luật.

## 12. Thay đổi
Khi chính sách thay đổi, chúng tôi cập nhật phiên bản và ngày ở đầu trang và thông báo trong ứng dụng.

---

# LOGINA Privacy Policy

**Version:** 0.3 (draft, not yet reviewed by a lawyer) · **Updated:** 31 October 2026 · **Contact:** logina.edu@gmail.com

## 1. Who we are
LOGINA helps teachers turn their own material into reasoning tasks. The LOGINA team runs it. Questions: **logina.edu@gmail.com**.

The demo has no accounts, and each browser has its own private workspace. Names in the sample lesson are fictional. No real classes use LOGINA yet. In a school, **the school decides how student data is used**, under a data-processing agreement signed before any pilot.

## 2. Data we collect
| Category | Examples | Whose |
|---|---|---|
| Anonymous session | A random ID for each browser, not linked to a name or email | All users |
| Account (not in the demo) | Name, email, role, class, school | Teachers, students |
| Materials and lessons | Uploaded files, the text AI read from them, teacher decisions, approved tasks | Teachers |
| Answers | Choices, confidence and timing before and after "Think again" | Students |
| Research consent | Your choice, the text version and the time | Students, demo users |
| Research data | One row per task: participant code, answers, confidence, timing, language, your Q5 text as typed. Recorded only if you agree | Participants who agreed |
| Teacher activity | Approvals, edits, assignments, warnings accepted | Teachers |
| Technical logs | IP address, browser, access times, errors | All users |

The demo never asks for your name, email or age. Please don't type personal details in Q5 or upload files containing them. We don't collect location, contacts, photos or biometrics, and we use no third-party analytics, tracking or advertising tools.

## 3. How we use it
- To run LOGINA: preparing, approving, assigning and completing tasks.
- To show teachers each student's choices and class summaries.
- To keep the service secure and fix problems.
- For research, only if you agree: data is copied to a Google Sheet the team reads, and may appear in a research paper describing groups only.

LOGINA does not grade or rank students, sell data, or share data for advertising.

## 4. AI
Gemini on Google Cloud Vertex AI reads teachers' files, drafts tasks and checks their logic. **Students' answers are never sent to AI.** Think-again prompts are approved by the teacher first and chosen by fixed rules. Under Google Cloud's terms, this data is not used to train Google's models.

## 5. Browser storage
| What | Where | Why |
|---|---|---|
| Anonymous session | IndexedDB | Keeps your private workspace. A new browser or cleared site data starts a new one |
| Demo tour seen | localStorage | Stops the tour showing again |

There are no advertising, analytics or third-party cookies, so LOGINA shows no cookie prompt.

## 6. Where data is stored
Data is stored on Google Cloud in **Singapore**. Sessions, AI requests, technical logs and the research Google Sheet may be held in other Google data centers, so data may leave Vietnam. Before a pilot with real students, we will complete the filings required by the Personal Data Protection Law and Decree 356/2025.

## 7. Who can see data
- **Students:** their own answers, and results after finishing.
- **Teachers:** answers from their own classes. In the demo, other browsers can't see your work.
- **The LOGINA team:** only to run the service, fix problems or read the research Google Sheet.
- **Google Cloud and Firebase:** under Google's data-processing terms.
- **Authorities:** where the law requires.

## 8. How long we keep it
- Demo workspaces: deleted after the competition. "Reset demo" deletes uploaded files sooner.
- Research data: until the paper is published, 2 years at most.
- Pilots: agreed with each school.
- Technical logs: about 30 days.

## 9. Children
LOGINA is for upper-secondary students. Students under 16 need a parent's or guardian's consent, which the school confirms before creating a class.

## 10. Your rights
You can access, correct or delete your data, withdraw consent, object to processing, or complain to the authorities. Email **logina.edu@gmail.com**; students may ask a teacher or parent to help. **To leave the study,** email your participant code. We don't know your name, so this code is the only way to find your data.

## 11. Security
Data is encrypted in transit and at rest, and each role receives only what it needs. Answer keys stay on the server. If a breach occurs, we will notify people as the law requires.

## 12. Changes
When this policy changes, we update the version and date at the top and announce it in the app.
