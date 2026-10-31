import { examples, type Examples } from './en.js';

type TextHeavy =
  | 'studentTask'
  | 'studentChallenge'
  | 'teacherTaskPreview'
  | 'teacherTaskSummary'
  | 'challengeList'
  | 'sourceReview'
  | 'sourceDraft'
  | 'trace'
  | 'studentFeedback';

const STEM =
  'Nhận định nào đúng về sự chuyển dịch cơ cấu lao động theo ngành ở nước ta? Chọn 1 nhận định và 1 thẻ căn cứ phù hợp nhất.';

const ANSWER_A =
  'Tỉ trọng lao động nông – lâm – thủy sản giảm; tỉ trọng công nghiệp – xây dựng và dịch vụ tăng.';
const ANSWER_B = 'Tỉ trọng lao động nông – lâm – thủy sản tăng.';
const ANSWER_C = 'Tỉ trọng lao động công nghiệp – xây dựng giảm.';
const ANSWER_D = 'Tỉ trọng lao động dịch vụ giảm, nhường chỗ cho công nghiệp – xây dựng.';
const ANSWER_A4 = 'Cuối giai đoạn không còn người làm nông – lâm – thủy sản.';

const CARD_1 = 'Nguồn cho biết tỉ trọng nông – lâm – thủy sản giảm, còn công nghiệp – xây dựng và dịch vụ tăng.';
const CARD_2 = 'Nguồn cho biết tỉ trọng nông – lâm – thủy sản giảm.';
const CARD_3 = 'Nguồn cho biết tỉ trọng nông – lâm – thủy sản tăng.';
const CARD_4 = 'Chất lượng lao động được cải thiện nhờ giáo dục và đào tạo.';

const TN1 = {
  label: 'TN1',
  purpose: 'Hướng của nguồn',
  whenShown: 'Khi học sinh chọn nhận định ngược chiều với nguồn',
  message:
    'Em hãy đối chiếu nhận định với số liệu ở đầu và cuối giai đoạn. Chiều biến động có nhất quán với lựa chọn của em không?',
};
const TN2 = {
  label: 'TN2',
  purpose: 'Đủ căn cứ',
  whenShown: 'Khi học sinh chọn A1 với thẻ chỉ hỗ trợ một vế',
  message: 'Câu A1 có hai vế. Thẻ em chọn đã làm căn cứ cho cả hai vế chưa?',
};
const TN3 = {
  label: 'TN3',
  purpose: 'Nhất quán nhận định và thẻ',
  whenShown: 'Khi thẻ nói ngược chiều với nhận định',
  message: 'Thẻ em chọn và nhận định của em có cùng nói về một chiều thay đổi không?',
};
const TN4 = {
  label: 'TN4',
  purpose: 'Liên quan',
  whenShown: 'Khi chọn thẻ không giải thích tỉ trọng (E4)',
  message: 'Thẻ em chọn nói về chất lượng lao động. Nó có giúp giải thích sự thay đổi tỉ trọng không?',
};
const FALLBACK = {
  label: 'Dự phòng',
  purpose: 'Kiểm tra căn cứ, trung lập',
  whenShown: 'Khi không câu nào ở trên khớp',
  message: 'Em hãy đọc lại thẻ căn cứ đã chọn. Nó hỗ trợ trực tiếp nhận định của em đến mức nào?',
};

const P8_1 =
  'Cơ cấu lao động theo ngành kinh tế ở nước ta có sự chuyển dịch theo hướng tích cực. Tỉ trọng lao động khu vực nông – lâm – thủy sản giảm; tỉ trọng lao động khu vực công nghiệp – xây dựng và dịch vụ tăng (Bảng 8.1).';
const P8_2 = 'Tuy vậy, lao động trong khu vực nông – lâm – thủy sản vẫn chiếm tỉ trọng lớn.';
const P9_1 = 'Chất lượng lao động ngày càng được nâng lên nhờ những thành tựu trong giáo dục và đào tạo.';
const P8_SHARE = 'Tỉ trọng lao động khu vực nông – lâm – thủy sản giảm';

const [issue1, issue2, issue3, issue4] = examples.sourceReview.issues;

/** Same IDs and structure as `examples`, Vietnamese text. Text-heavy DTOs only. */
export const examplesVi = {
  studentTask: {
    ...examples.studentTask,
    stem: STEM,
    answers: [
      { id: 'opt_1', text: ANSWER_A },
      { id: 'opt_2', text: ANSWER_B },
      { id: 'opt_3', text: ANSWER_C },
      { id: 'opt_4', text: ANSWER_D },
    ],
    evidence: [
      { id: 'ev_1', text: CARD_1 },
      { id: 'ev_2', text: CARD_2 },
      { id: 'ev_3', text: CARD_3 },
      { id: 'ev_4', text: CARD_4 },
    ],
  },

  studentChallenge: {
    ...examples.studentChallenge,
    message: TN1.message,
    lockedSummary: { answerText: `B. ${ANSWER_B}`, evidenceText: `Thẻ 3. ${CARD_3}`, confidence: 70 },
  },

  teacherTaskPreview: {
    ...examples.teacherTaskPreview,
    questionStem: STEM,
    answers: [
      { id: 'A1', text: ANSWER_A, teacherLabel: 'Đúng · nguồn hỗ trợ cả hai vế', sourceAnchor: 'Bảng 8.1' },
      { id: 'A2', text: ANSWER_B, teacherLabel: 'Phương án sai · nguồn bác bỏ', sourceAnchor: 'Bảng 8.1' },
      { id: 'A3', text: ANSWER_C, teacherLabel: 'Phương án sai · nguồn bác bỏ', sourceAnchor: 'Bảng 8.1' },
      {
        id: 'A4',
        text: ANSWER_A4,
        teacherLabel: 'Phương án sai · nguồn bác bỏ',
        sourceAnchor: 'tr. 8 · đoạn 2',
        inlineFinding: {
          gateId: 'QG3',
          findingCode: 'DISTRACTOR_IMPLAUSIBLE',
          explanationForTeacher:
            'Học sinh có thể loại phương án này chỉ nhờ từ ngữ cực đoan (“không còn”), chưa cần đối chiếu nguồn.',
          overridable: true,
        },
      },
    ],
    evidence: [
      { id: 'E1', text: CARD_1, teacherLabel: 'Đầy đủ', relationNote: 'đủ cả hai vế của A1', sourceAnchor: 'Bảng 8.1' },
      {
        id: 'E2',
        text: CARD_2,
        teacherLabel: 'Một phần',
        relationNote: 'đúng, nhưng thiếu vế “tăng”',
        sourceAnchor: 'Bảng 8.1',
      },
      { id: 'E3', text: CARD_3, teacherLabel: 'Sai dữ kiện', relationNote: 'nguồn phản chứng', sourceAnchor: 'Bảng 8.1' },
      {
        id: 'E4',
        text: CARD_4,
        teacherLabel: 'Không liên quan',
        relationNote: 'đúng, nhưng không giải thích tỉ trọng',
        sourceAnchor: 'tr. 9',
      },
    ],
    exampleChallenges: [TN1, TN2],
    gates: [
      {
        gateId: 'QG1',
        status: 'PASS',
        explanationForTeacher: 'Câu hỏi buộc học sinh đối chiếu căn cứ, đúng mục tiêu đã chọn.',
      },
      { gateId: 'QG2', status: 'PASS', explanationForTeacher: 'Nguồn đủ để xác nhận A1 và bác bỏ A2 đến A4.' },
      {
        gateId: 'QG3',
        status: 'REVIEW_REQUIRED',
        explanationForTeacher: 'A4 dễ bị loại nhờ từ ngữ cực đoan. Sửa câu chữ hoặc chấp nhận kèm lý do.',
      },
      { gateId: 'QG4', status: 'PASS', explanationForTeacher: 'Bốn thẻ có vai trò khác nhau, không trùng nghĩa.' },
      {
        gateId: 'QG5',
        status: 'PASS',
        explanationForTeacher: 'Không câu nào lộ đáp án; câu dự phòng trung lập.',
      },
      {
        gateId: 'QG6',
        status: 'PASS',
        explanationForTeacher: 'Câu hỏi, nhận định, thẻ và nguồn cùng nói về một giai đoạn.',
      },
    ],
    structureChecks: [
      { label: '4 nhận định, 4 thẻ đúng loại', status: 'PASS' },
      { label: 'Đã đánh giá 16/16 cặp nhận định × thẻ', status: 'PASS' },
      { label: 'Mọi lựa chọn nhận đúng 1 câu Thử nghĩ thêm', status: 'PASS' },
      { label: 'Mọi nội dung có vị trí nguồn', status: 'PASS' },
    ],
  },

  teacherTaskSummary: {
    ...examples.teacherTaskSummary,
    questionStem: 'Hãy xếp các yếu tố sau theo mức độ ảnh hưởng đến sự chuyển dịch cơ cấu lao động.',
    taskBody: {
      cards: [
        { cardId: 'card_1', text: 'Công nghiệp hóa, hiện đại hóa tạo thêm việc làm trong công nghiệp và dịch vụ.' },
        { cardId: 'card_2', text: 'Đô thị hóa thu hút lao động từ nông thôn đến đô thị và khu công nghiệp.' },
        { cardId: 'card_3', text: 'Hội nhập kinh tế quốc tế và đầu tư nước ngoài mở ra việc làm mới.' },
        { cardId: 'card_4', text: 'Chất lượng lao động được nâng lên nhờ giáo dục và đào tạo.' },
      ],
      basis: 'Xếp theo mức độ mỗi yếu tố tác động trực tiếp đến tỉ trọng lao động theo ngành.',
      teacherLabels: { card_1: 'Mạnh nhất', card_4: 'Yếu nhất' },
    },
    gates: [
      { gateId: 'QG1', status: 'PASS', explanationForTeacher: 'Việc xếp thẻ buộc học sinh cân nhắc các yếu tố.' },
      { gateId: 'QG5', status: 'PASS', explanationForTeacher: 'Không câu nào lộ thứ tự mong đợi.' },
    ],
    exampleChallenges: [
      {
        label: 'TN1',
        purpose: 'Kiểm tra tiêu chí',
        whenShown: 'Khi học sinh xếp yếu tố bối cảnh lên đầu',
        message: 'Em hãy xem lại tiêu chí. Thẻ em xếp đầu có trực tiếp làm thay đổi tỉ trọng lao động không?',
      },
    ],
  },

  challengeList: {
    ...examples.challengeList,
    challenges: [
      { ...TN1, challengeId: 'TN1', isFallback: false, sourceAnchor: 'Bảng 8.1' },
      { ...TN2, challengeId: 'TN2', isFallback: false, sourceAnchor: 'Bảng 8.1' },
      { ...TN3, challengeId: 'TN3', isFallback: false, sourceAnchor: 'Bảng 8.1' },
      { ...TN4, challengeId: 'TN4', isFallback: false, sourceAnchor: 'tr. 9' },
      { ...FALLBACK, challengeId: 'FB', isFallback: true, sourceAnchor: 'Bảng 8.1' },
    ],
  },

  sourceReview: {
    ...examples.sourceReview,
    summaryClaims: [
      {
        id: 'clm_1',
        wording: 'Tỉ trọng lao động nông – lâm – thủy sản giảm.',
        evidenceSnippet: '…tỉ trọng lao động khu vực nông – lâm – thủy sản giảm…',
        locator: 'tr. 8 · Bảng 8.1',
        status: 'VERIFIED',
      },
      {
        id: 'clm_2',
        wording: 'Tỉ trọng lao động công nghiệp – xây dựng tăng.',
        evidenceSnippet: '…công nghiệp – xây dựng và dịch vụ tăng…',
        locator: 'tr. 8 · Bảng 8.1',
        status: 'VERIFIED',
      },
      {
        id: 'clm_3',
        wording: 'Tỉ trọng lao động dịch vụ tăng.',
        evidenceSnippet: '…công nghiệp – xây dựng và dịch vụ tăng…',
        locator: 'tr. 8 · Bảng 8.1',
        status: 'VERIFIED',
      },
      {
        id: 'clm_4',
        wording: 'Cuối giai đoạn vẫn còn lao động nông – lâm – thủy sản.',
        evidenceSnippet: '…vẫn chiếm tỉ trọng lớn.',
        locator: 'tr. 8 · đoạn 2',
        status: 'VERIFIED',
      },
      {
        id: 'clm_5',
        wording: 'Chất lượng lao động được nâng lên (bối cảnh).',
        evidenceSnippet: '…nhờ những thành tựu trong giáo dục và đào tạo.',
        locator: 'tr. 9 · đoạn 1',
        status: 'VERIFIED',
      },
    ],
    teacherDecisions: [
      {
        issueId: 'iss_2',
        label: 'Mục tiêu',
        text: 'HS đánh giá một nhận định về chuyển dịch cơ cấu lao động có được căn cứ hỗ trợ đầy đủ không.',
        note: 'Chọn từ gợi ý AI, căn cứ Bảng 8.1. Đây là chỉ dẫn dạy học, không phải dữ kiện nguồn.',
      },
    ],
    openGaps: [
      {
        issueId: 'iss_1',
        reason: 'Số người làm nông – lâm – thủy sản có giảm không: nguồn không xác định.',
        bounds: 'Không dùng làm đáp án cố định. Học sinh chỉ được kết luận về tỉ trọng.',
      },
    ],
    excluded: [
      {
        issueId: 'iss_4',
        text: 'Số liệu 2015 từ nguồn phụ.',
        reason: 'Lệch năm so với Bảng 8.1. Không được dùng khi soạn bài; vẫn lưu trong lịch sử.',
      },
    ],
    material: {
      ...examples.sourceReview.material,
      title: 'Tài liệu mẫu Lao động và việc làm',
      locator: 'tr. 8–9',
      paragraphs: [
        { id: 'p8-1', page: 8, text: P8_1, readBy: 'SEEDED' },
        { id: 'p8-2', page: 8, text: P8_2, readBy: 'SEEDED' },
        { id: 'p9-1', page: 9, text: P9_1, readBy: 'SEEDED' },
      ],
    },
    issues: [
      {
        ...issue1!,
        bubble:
          'Tài liệu nói tỉ trọng nông – lâm – thủy sản giảm, nhưng chưa có tổng số lao động để biết số người có giảm không. Cô muốn giữ đây là điểm học sinh phải xem xét hay bổ sung nguồn?',
        currentInterpretation: 'Chỉ kết luận về tỉ trọng, không kết luận về số người.',
        spans: [
          {
            paragraphId: 'p8-1',
            start: P8_1.indexOf(P8_SHARE),
            end: P8_1.indexOf(P8_SHARE) + P8_SHARE.length,
          },
        ],
        resolution: {
          action: 'KEEP_OPEN',
          text: 'Không dùng làm đáp án cố định. Học sinh chỉ được kết luận về tỉ trọng.',
          savedAs: 'TASK_ASSUMPTION',
        },
        resolvedBy: 'Cô Lan',
      },
      {
        ...issue2!,
        bubble: 'Với phần này, cô muốn học sinh nhận ra xu hướng chuyển dịch, hay kiểm tra một kết luận vượt quá dữ liệu?',
        currentInterpretation: 'Nhận ra xu hướng chuyển dịch.',
        suggestions: [
          {
            id: 'sug_1',
            text: 'Nhận ra xu hướng và chọn căn cứ đủ cho cả hai vế',
            sourceRef: 'Bảng 8.1 có đủ hai chiều giảm và tăng',
          },
          {
            id: 'sug_2',
            text: 'Kiểm tra kết luận vượt quá dữ liệu (tỉ trọng khác số người)',
            sourceRef: 'Nguồn không có tổng số lao động',
          },
        ],
        resolution: {
          action: 'USE_SUGGESTION',
          text: 'Nhận ra xu hướng và chọn căn cứ đủ cho cả hai vế',
          savedAs: 'TEACHER_INTERPRETATION',
        },
        resolvedBy: 'Cô Lan',
      },
      {
        ...issue3!,
        bubble:
          'Có thể dùng “Chất lượng lao động được nâng lên” làm căn cứ cho cơ cấu ngành không, hay đó chỉ là thông tin bối cảnh?',
        currentInterpretation: 'Thông tin bối cảnh; không giải thích cơ cấu tỉ trọng.',
        spans: [{ paragraphId: 'p9-1', start: 0, end: P9_1.length }],
        resolvedBy: 'Cô Lan',
      },
      {
        ...issue4!,
        bubble: 'Số liệu 2015 trong nguồn phụ lệch năm so với Bảng 8.1.',
        currentInterpretation: 'Chỉ dùng Bảng 8.1.',
        resolution: { action: 'EXCLUDE', text: 'Lệch năm so với nguồn chính.', savedAs: null },
        resolvedBy: 'Cô Lan',
      },
    ],
  },

  sourceDraft: {
    ...examples.sourceDraft,
    editedClaims: [
      {
        claimId: 'clm_1',
        before: 'Tỉ trọng lao động nông – lâm – thủy sản giảm.',
        after: 'Tỉ trọng lao động nông – lâm – thủy sản giảm trong giai đoạn 2010–2021.',
        evidence: '“…giai đoạn 2010–2021…” · tiêu đề Bảng 8.1',
      },
    ],
    impact: [
      { slot: 'Q1', usesClaim: true, refs: ['A1', 'E1', 'E2', 'E3'] },
      { slot: 'Q2', usesClaim: true, refs: ['thẻ “Công nghiệp hóa”'] },
      { slot: 'Q3', usesClaim: false, refs: [] },
      { slot: 'Q4', usesClaim: false, refs: [] },
      { slot: 'Q5', usesClaim: false, refs: [] },
    ],
  },

  trace: {
    ...examples.trace,
    questionStem: STEM,
    before: {
      ...examples.trace.before,
      answer: { letter: 'B', authoringLabel: 'A2', text: 'Tỉ trọng lao động nông – lâm – thủy sản tăng.' },
      evidence: {
        letter: 'Thẻ 3',
        authoringLabel: 'E3',
        text: 'Nguồn cho biết tỉ trọng nông – lâm – thủy sản tăng.',
      },
      relationLabel: 'Cùng ý, nguồn bác bỏ cả hai',
    },
    challenge: {
      ...examples.trace.challenge,
      message: TN1.message,
      whySelected: 'Nhận định ngược chiều với nguồn.',
    },
    after: {
      ...examples.trace.after,
      answer: {
        letter: 'A',
        authoringLabel: 'A1',
        text: 'Tỉ trọng nông – lâm – thủy sản giảm; công nghiệp – xây dựng và dịch vụ tăng.',
        changed: true,
      },
      evidence: {
        letter: 'Thẻ 1',
        authoringLabel: 'E1',
        text: 'Nguồn cho biết tỉ trọng nông – lâm – thủy sản giảm, còn công nghiệp – xây dựng và dịch vụ tăng.',
        changed: true,
      },
      relationLabel: 'Hỗ trợ đầy đủ',
    },
  },

  studentFeedback: {
    ...examples.studentFeedback,
    initial: { label: 'B · Thẻ 3', text: 'Tỉ trọng nông – lâm – thủy sản tăng · thẻ nói tỉ trọng tăng' },
    challengeMessage: 'Đối chiếu số liệu đầu và cuối giai đoạn.',
    final: {
      label: 'A · Thẻ 1',
      text: 'Nông – lâm – thủy sản giảm; công nghiệp – xây dựng và dịch vụ tăng · thẻ nêu đủ hai chiều',
    },
    explanations: [
      {
        optionId: 'ev_2',
        relationLabel: 'Hỗ trợ một phần',
        text: 'Đúng nhưng chỉ nói vế “giảm”, chưa đủ cho cả nhận định A.',
      },
      { optionId: 'ev_3', relationLabel: 'Mâu thuẫn', text: 'Trái với Bảng 8.1.' },
      {
        optionId: 'ev_4',
        relationLabel: 'Không liên quan',
        text: 'Đúng theo nguồn nhưng nói về chất lượng lao động, không giải thích tỉ trọng.',
      },
    ],
  },
} satisfies Pick<Examples, TextHeavy>;
