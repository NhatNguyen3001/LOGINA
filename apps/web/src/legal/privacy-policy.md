# Chính sách quyền riêng tư của LOGINA

**Phiên bản:** 0.1 (bản nháp) · **Hiệu lực từ:** [ngày] · **Liên hệ:** logina.edu@gmail.com

## 1. Chúng tôi là ai
LOGINA là công cụ giúp giáo viên tạo nhiệm vụ suy luận từ học liệu của mình và giúp học sinh luyện cân nhắc căn cứ. LOGINA được phát triển bởi nhóm LOGINA [cần quyết định: tên và địa chỉ pháp nhân]. Mọi câu hỏi về dữ liệu cá nhân, xin gửi về **logina.edu@gmail.com**.

Khi một trường học sử dụng LOGINA cho lớp học, **nhà trường là bên quyết định việc sử dụng dữ liệu của học sinh**, còn LOGINA xử lý dữ liệu theo yêu cầu của nhà trường. [Cần thỏa thuận xử lý dữ liệu với từng trường trước khi thí điểm.]

**Bản trình diễn (demo):** bản trình diễn không có tài khoản; ai có liên kết cũng dùng được, và mỗi trình duyệt có một không gian làm việc riêng. Tên học sinh và giáo viên trong bài mẫu là hư cấu. Không có dữ liệu của học sinh thật. Người tham gia nghiên cứu trong bản trình diễn (ví dụ ban giám khảo) là người lớn; LOGINA không hỏi tên hay email của họ.

## 2. Dữ liệu chúng tôi thu thập
| Loại dữ liệu | Ví dụ | Của ai |
|---|---|---|
| Tài khoản (không có trong bản trình diễn) | Họ tên, email, vai trò (giáo viên/học sinh), lớp, trường | Giáo viên, học sinh |
| Phiên ẩn danh (bản trình diễn) | Mã phiên ngẫu nhiên do Firebase Authentication tạo cho mỗi trình duyệt; không gắn với tên hay email | Mọi người dùng |
| Học liệu và bài soạn | Tệp học liệu tải lên (PDF hoặc Word) và nội dung AI đọc được từ tệp, thông tin nguồn, quyết định khi làm rõ học liệu, nhiệm vụ đã duyệt | Giáo viên |
| Bài làm | Lựa chọn trước và sau câu “Thử nghĩ thêm”, mức tự tin, thời điểm chốt và nộp, giữ hay sửa | Học sinh |
| Đồng ý tham gia nghiên cứu | Lựa chọn (đồng ý hoặc không), phiên bản văn bản đồng ý và thời điểm | Người dùng bản trình diễn, học sinh |
| Mã người tham gia | Mã ngẫu nhiên, không tạo từ tên; dùng để rút khỏi nghiên cứu | Người tham gia nghiên cứu |
| Dữ liệu nghiên cứu | Với mỗi nhiệm vụ đã nộp, một dòng: mã người tham gia, lựa chọn và mức tự tin trước và sau câu “Thử nghĩ thêm”, giữ hay sửa, câu trả lời viết ở Q5, thời gian làm, ngôn ngữ giao diện. Không có tên hay email. Câu trả lời viết ở Q5 được lưu nguyên văn, vì vậy xin đừng gõ thông tin cá nhân vào đó. Mã người tham gia được hiển thị sau khi đồng ý và ở trang kết quả. Chỉ ghi khi người tham gia đã đồng ý | Người tham gia đã đồng ý |
| Ngôn ngữ giao diện | Tiếng Anh hoặc tiếng Việt; lưu cùng phiên hoặc tài khoản, không lưu trên trình duyệt | Giáo viên, học sinh |
| Nhật ký thao tác của giáo viên | Ai làm gì và khi nào: duyệt nguồn, duyệt nhiệm vụ, sửa, giao bài, chấp nhận cảnh báo kèm lý do | Giáo viên |
| Nhật ký kỹ thuật | Địa chỉ IP, loại trình duyệt, thời gian truy cập, lỗi | Mọi người dùng |

Chúng tôi **không** thu thập: vị trí, danh bạ, ảnh, dữ liệu sinh trắc học, hay dữ liệu từ mạng xã hội. Chúng tôi **không** dùng công cụ phân tích hoặc theo dõi của bên thứ ba, và **không** dùng công cụ quảng cáo. Việc duy nhất phân tích cách mọi người dùng LOGINA là nghiên cứu nêu ở mục 3, và chỉ với người tham gia đã đồng ý.

## 3. Chúng tôi dùng dữ liệu để làm gì
- Cho giáo viên soạn, duyệt và giao bài; cho học sinh làm bài.
- Cho giáo viên xem lựa chọn của học sinh trước và sau câu “Thử nghĩ thêm” (trace) và thống kê của lớp.
- Giữ an toàn hệ thống, tìm và sửa lỗi.
- Nghiên cứu, chỉ với người tham gia đã đồng ý: dữ liệu nghiên cứu được chép vào một Google Sheet mà nhóm LOGINA đọc, và có thể được dùng trong một bài báo nghiên cứu. Kết quả chỉ mô tả nhóm, không mô tả từng cá nhân.

LOGINA **không chấm điểm** và không xếp hạng học sinh. Phân tích nghiên cứu mô tả cách các nhóm phản ứng với gợi ý, và không báo cáo điều gì về từng cá nhân. LOGINA **không bán hoặc chia sẻ dữ liệu cho quảng cáo**.

## 4. Trí tuệ nhân tạo (AI)
LOGINA dùng mô hình Gemini của Google (qua Google Cloud Vertex AI) để đọc học liệu của giáo viên, soạn nháp nhiệm vụ và kiểm tra logic. **Bài làm của học sinh không được gửi tới AI.** Câu “Thử nghĩ thêm” học sinh nhận được là câu đã được giáo viên duyệt từ trước, được chọn bằng quy tắc cố định, không phải do AI viết ra lúc học sinh làm bài. **Tệp học liệu giáo viên tải lên** được lưu trên Google Cloud Storage và được gửi, cùng nội dung chữ của tệp, tới Gemini trên Vertex AI để đọc; nội dung AI đọc được lưu làm bản nguồn để giáo viên kiểm tra và duyệt. Xin đừng tải lên tệp chứa dữ liệu cá nhân (ví dụ danh sách hay bài làm của học sinh). Theo điều khoản của Google Cloud, dữ liệu gửi tới Vertex AI không được dùng để huấn luyện mô hình của Google. [Kiểm tra lại điều khoản hiện hành của Google Cloud trước khi công bố.]

## 5. Lưu trữ dữ liệu trên trình duyệt (thay cho “cookie”)
LOGINA chỉ lưu trên trình duyệt những gì cần để ứng dụng hoạt động:
| Lưu gì | Ở đâu | Để làm gì |
|---|---|---|
| Phiên ẩn danh | IndexedDB của trình duyệt (Firebase Authentication) | Cho mỗi trình duyệt một không gian làm việc riêng, không cần đăng nhập. Trình duyệt mới, cửa sổ riêng tư hoặc xóa dữ liệu trang sẽ tạo phiên mới và không gian làm việc mới; không gian cũ không mở lại được |
| Thanh bên thu gọn hay mở | localStorage | Nhớ cách bạn bố trí màn hình |

Không có cookie quảng cáo, cookie phân tích hay cookie của bên thứ ba. Phông chữ được tải từ chính máy chủ của LOGINA. Vì chỉ dùng phần lưu trữ thiết yếu, LOGINA không hiển thị hộp chọn đồng ý cookie. Nếu sau này chúng tôi thêm công cụ không thiết yếu (ví dụ công cụ phân tích hay theo dõi của bên thứ ba), chúng tôi sẽ hỏi ý kiến bạn trước.

## 6. Nơi lưu trữ và chuyển dữ liệu ra nước ngoài
Dữ liệu được lưu trên Google Cloud tại **Singapore** (khu vực asia-southeast1). Dịch vụ phiên (Firebase Authentication) của Google có thể lưu thông tin phiên ở các trung tâm dữ liệu khác của Google. Dữ liệu nghiên cứu cũng được chép vào một **Google Sheet không nằm trong khu vực Singapore**; Google có thể lưu Sheet này ở các trung tâm dữ liệu khác. Các việc này là **chuyển dữ liệu cá nhân ra ngoài lãnh thổ Việt Nam**. [Hoàn thành các thủ tục và hồ sơ theo Luật Bảo vệ dữ liệu cá nhân và Nghị định 356/2025 trước khi thí điểm.] [Cần quyết định: nơi Vertex AI xử lý dữ liệu; khu vực lưu nhật ký Cloud Logging.]

## 7. Ai được xem dữ liệu
- **Học sinh:** bài làm của chính mình; kết quả và nhận xét sau khi hoàn thành cả bộ bài.
- **Giáo viên:** bài làm của học sinh trong lớp mình phụ trách; không xem được lớp khác. Trong bản trình diễn, mỗi trình duyệt có không gian riêng; người dùng khác không thấy bài của bạn.
- **Nhóm LOGINA:** chỉ khi cần để vận hành, sửa lỗi, theo yêu cầu của nhà trường, hoặc để đọc Google Sheet nghiên cứu.
- **Nhà cung cấp hạ tầng:** Google Cloud và Firebase, theo hợp đồng xử lý dữ liệu của Google.
- **Cơ quan nhà nước:** khi pháp luật yêu cầu.

## 8. Lưu trữ bao lâu
- Bản trình diễn: sau cuộc thi, toàn bộ không gian làm việc trình diễn bị xóa. Tệp học liệu tải lên trong bản trình diễn và nội dung đọc từ tệp cũng bị xóa khi không gian làm việc của trình duyệt đó được đặt lại (“Đặt lại demo”), và chậm nhất là sau cuộc thi.
- Dữ liệu nghiên cứu (các dòng nghiên cứu, bản ghi người tham gia và Google Sheet): giữ đến khi bài báo được công bố, và không quá 2 năm kể từ lúc thu thập. Sau đó chúng tôi xóa.
- Thí điểm: [đề xuất: đến hết năm học, sau đó xóa hoặc ẩn danh trong vòng 30 ngày, trừ khi nhà trường yêu cầu khác].
- Nhật ký kỹ thuật: [30 ngày, theo mặc định của Cloud Logging].

## 9. Trẻ em và học sinh chưa đủ 18 tuổi
LOGINA dành cho học sinh trung học phổ thông. Với học sinh **dưới 16 tuổi**, cần có sự đồng ý của cha mẹ hoặc người giám hộ theo quy định của pháp luật Việt Nam về dữ liệu cá nhân của trẻ em. Nhà trường xác nhận việc này trước khi tạo lớp. Học sinh thật sẽ xem màn hình “Tham gia nghiên cứu” trước nhiệm vụ đầu tiên. **Trong bản trình diễn,** người tham gia nghiên cứu cho biết mình từ 18 tuổi trở lên (tự khai). [Luật sư cần xác nhận ngưỡng tuổi và cách lấy đồng ý theo Luật 91/2025 và Nghị định 356/2025.]

## 10. Quyền của bạn
Bạn có quyền: được biết; xem dữ liệu của mình; yêu cầu sửa; yêu cầu xóa; rút lại sự đồng ý; phản đối hoặc hạn chế việc xử lý; khiếu nại tới cơ quan có thẩm quyền. Gửi yêu cầu tới **logina.edu@gmail.com**; học sinh có thể nhờ giáo viên hoặc cha mẹ gửi giúp. **Để rút khỏi nghiên cứu,** hãy gửi mã người tham gia của bạn tới địa chỉ này; nhóm sẽ xóa thủ công các dòng của bạn khỏi Google Sheet và cơ sở dữ liệu. Vì LOGINA không biết tên bạn, chúng tôi chỉ tìm được dữ liệu của bạn qua mã này. Chúng tôi trả lời trong thời hạn pháp luật quy định.

## 11. Bảo mật
Dữ liệu được mã hóa khi truyền và khi lưu (mặc định của Google Cloud). Mỗi vai trò chỉ nhận đúng dữ liệu cần thiết; đáp án và quy tắc chấm chỉ nằm trên máy chủ. Không có mật khẩu nào của dịch vụ nằm trong mã nguồn. Nếu xảy ra sự cố lộ dữ liệu, chúng tôi sẽ thông báo cho nhà trường, người bị ảnh hưởng và cơ quan có thẩm quyền theo quy định.

## 12. Thay đổi chính sách
Khi chính sách thay đổi, chúng tôi cập nhật phiên bản và ngày hiệu lực ở đầu trang và thông báo trong ứng dụng.

---

# LOGINA Privacy Policy (English)

**Version:** 0.1 (draft) · **Effective:** [date] · **Contact:** logina.edu@gmail.com

## 1. Who we are
LOGINA helps teachers create reasoning tasks from their own teaching materials and helps students practice weighing evidence. It is developed by the LOGINA team [to decide: legal entity name and address]. Questions about personal data: **logina.edu@gmail.com**.

When a school uses LOGINA with its classes, **the school decides how student data is used**, and LOGINA processes it on the school's behalf. [A data-processing agreement with each school is needed before the pilot.]

**Demo:** the demo has no accounts; anyone with the link can use it, and each browser has its own private workspace. All student and teacher names in the sample lesson are fictional. No real student data is used. Research participants in the demo (for example judges) are adults; LOGINA does not ask for their name or email.

## 2. Data we collect
| Category | Examples | Whose |
|---|---|---|
| Account (not in the demo) | Name, email, role (teacher/student), class, school | Teachers, students |
| Anonymous session (demo) | A random session ID created by Firebase Authentication for each browser; not linked to a name or email | All users |
| Materials and lesson content | Uploaded files (PDF or Word) and the text AI read from them, source details, clarification decisions, approved tasks | Teachers |
| Answers | Choices before and after the "Think again" prompt, confidence, lock and submit times, keep or revise | Students |
| Research consent | The choice (agree or not), the version of the consent text and the time | Demo users, students |
| Participant code | A random code, not made from a name; used to withdraw from the study | Research participants |
| Research data | For each submitted task, one row: participant code, choices and confidence before and after the "Think again" prompt, keep or revise, the written answer in Q5, timings, interface language. No name or email. Written Q5 answers are stored as typed, so please do not type personal details there. The participant code is shown after agreeing and on the results page. Recorded only when the participant has agreed | Participants who agreed |
| Interface language | English or Vietnamese; stored with the session or account, not in the browser | Teachers, students |
| Audit log of teacher actions | Who did what and when: source approval, task approval, edits, assigning, warnings accepted with a reason | Teachers |
| Technical logs | IP address, browser type, access times, errors | All users |

We do **not** collect location, contacts, photos, biometrics or social-media data, and we use **no** third-party analytics or tracking tools and **no** advertising tools. The only analysis of how people use LOGINA is the research in section 3, and only for participants who agreed.

## 3. How we use it
- To let teachers prepare, approve and assign tasks, and students complete them.
- To show teachers each student's choices before and after the prompt (the trace) and class summaries.
- To keep the service secure and fix problems.
- For research, only for participants who agreed: research data is copied to a Google Sheet the LOGINA team reads, and may be used in a research paper. Results describe groups only, never an individual.

LOGINA does not grade or rank students. Research analysis describes how groups respond to the prompt, and nothing is reported about any individual. LOGINA does **not sell or share data for advertising**.

## 4. Artificial intelligence
LOGINA uses Google's Gemini models (through Google Cloud Vertex AI) to read teachers' materials, draft tasks and check their logic. **Students' answers are not sent to AI.** The prompt a student receives was approved by the teacher in advance and is chosen by fixed rules, not written by AI while the student works. **Material files that teachers upload** are stored in Google Cloud Storage and sent, together with their text, to Gemini on Vertex AI to be read; the text AI reads is stored as the source for the teacher to check and approve. Please do not upload files containing personal data (for example class lists or students' work). Under Google Cloud's terms, data sent to Vertex AI is not used to train Google's models. [Re-check Google Cloud's current terms before publishing.]

## 5. Browser storage (instead of "cookies")
LOGINA stores only what the app needs to work:
| What | Where | Why |
|---|---|---|
| Anonymous session | Browser IndexedDB (Firebase Authentication) | Gives each browser its own private workspace without signing in. A new browser, a private window or cleared site data creates a new session and a new workspace; the old one can't be reopened |
| Sidebar collapsed or open | localStorage | Remembers your layout |

There are no advertising, analytics or third-party cookies, and fonts are served from LOGINA itself. Because only essential storage is used, LOGINA shows no cookie consent prompt. If we ever add anything non-essential (such as third-party analytics or tracking tools), we will ask you first.

## 6. Where data is stored, and transfers outside Vietnam
Data is stored on Google Cloud in **Singapore** (region asia-southeast1). Google's session service (Firebase Authentication) may store session details in other Google data centers. Research data is also copied to a **Google Sheet that is not held in the Singapore region**; Google may store it in other data centers. These are **transfers of personal data outside Vietnam**. [Complete the filings and documentation required by the Personal Data Protection Law and Decree 356/2025 before the pilot.] [To decide: Vertex AI processing location; Cloud Logging bucket region.]

## 7. Who can see data
- **Students:** their own answers; results and feedback after finishing the whole set.
- **Teachers:** answers of students in the classes they teach, and no other classes. In the demo, each browser has its own workspace; other users can't see your lessons.
- **The LOGINA team:** only when needed to run the service, fix problems, at the school's request, or to read the research Google Sheet.
- **Infrastructure providers:** Google Cloud and Firebase, under Google's data-processing terms.
- **Authorities:** where the law requires.

## 8. How long we keep it
- Demo: after the competition, all demo workspaces are deleted. Files uploaded in the demo, and the text read from them, are also deleted when that browser's workspace is reset ("Reset demo"), and at the latest after the competition.
- Research data (research rows, participant records and the Google Sheet): kept until the paper is published, and for no more than 2 years from collection. Then we delete it.
- Pilot: [proposal: until the end of the school year, then deleted or anonymized within 30 days unless the school requests otherwise].
- Technical logs: [30 days, Cloud Logging default].

## 9. Children and students under 18
LOGINA is for upper-secondary students. For students **under 16**, a parent or guardian's consent is required under Vietnamese rules on children's personal data. The school confirms this before creating a class. Real students will see the "Taking part in research" screen before their first task. **In the demo,** research participants say they are 18 or older (self-declared). [A lawyer must confirm the age thresholds and how consent is obtained under Law 91/2025 and Decree 356/2025.]

## 10. Your rights
You can: be informed; access your data; ask for corrections; ask for deletion; withdraw consent; object to or restrict processing; complain to the competent authority. Email **logina.edu@gmail.com**; students may ask a teacher or parent to send the request. **To withdraw from the study,** email your participant code to this address; the team will delete your rows by hand from the Google Sheet and the database. Because LOGINA does not know your name, we can find your data only through this code. We reply within the time the law requires.

## 11. Security
Data is encrypted in transit and at rest (Google Cloud defaults). Each role receives only the data it needs; answer keys and checking rules stay on the server. No service passwords are kept in the source code. If a data breach occurs, we will notify the school, affected people and the authorities as the law requires.

## 12. Changes
When this policy changes, we update the version and effective date at the top and announce it in the app.
