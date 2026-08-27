import type { AppLocale } from "../i18n/config";

export interface OperationsCopy {
  activeBlocks: string;
  activeQr: string;
  apply: string;
  back: string;
  batches: string;
  contactCount: string;
  cost: string;
  days: string;
  description: string;
  detail: string;
  deliveryGroup: string;
  comparePrevious: string;
  comparePreviousActive: string;
  emptySites: string;
  escalated: string;
  eyebrow: string;
  failed: string;
  freshAt: string;
  generatedQr: string;
  inventoryGroup: string;
  line1: string;
  line2: string;
  noTrendData: string;
  liveStatus: string;
  liveUpdating: string;
  manualGates: string;
  manualGatesDescription: string;
  medianResponse: string;
  missingCost: string;
  openReports: string;
  outputReadyBatches: string;
  pendingActivation: string;
  period: string;
  periodCustom: string;
  periodToday: string;
  pageNext: string;
  pagePrevious: string;
  pageSize: string;
  paginationLabel: string;
  qrConsole: string;
  qrSnapshotDescription: string;
  reviewChecks: string;
  retrying: string;
  safetyGroup: string;
  sent: string;
  siteCount: string;
  siteComparison: string;
  siteComparisonDescription: string;
  startDate: string;
  endDate: string;
  totalSites: string;
  scope: string;
  scopeAll: string;
  secondsUnit: string;
  trend: string;
  trendDescription: string;
  todayGroup: string;
  totalQr: string;
  workQueue: string;
  workQueueDescription: string;
  workQueueEmpty: string;
  workQueueUnavailable: string;
  workQueueCount: string;
  workType: string;
  workLocation: string;
  workStatus: string;
  workElapsed: string;
  workLastAttempt: string;
  workAssignee: string;
  workActions: string;
  workAcknowledge: string;
  workAssignSelf: string;
  workStart: string;
  workResolve: string;
  workRetry: string;
  workDefaultReason: string;
  workPriority: string;
  workSla: string;
  workUnassigned: string;
  workNotSet: string;
  workOpen: string;
  workKinds: Readonly<Record<string, string>>;
  workStatuses: Readonly<Record<string, string>>;
  workQueueStates: Readonly<Record<string, string>>;
  unresolved: string;
  unavailableDescription: string;
  unavailableTitle: string;
}

export const OPERATIONS_COPY: Readonly<Record<AppLocale, OperationsCopy>> = Object.freeze({
  en: {
    activeBlocks: "Active caller blocks",
    activeQr: "Active QR assets",
    apply: "Apply",
    back: "Back to dashboard",
    batches: "Completed QR batches",
    contactCount: "Contact requests",
    cost: "Recorded provider cost",
    comparePrevious: "Compare with previous period",
    comparePreviousActive: "Comparing with previous period",
    days: "days",
    description:
      "Review the last 24 hours of contact, delivery, safety, and inventory signals within your authorized site scope.",
    detail: "View location",
    deliveryGroup: "Notification delivery",
    emptySites: "No operating locations are available in the selected scope.",
    escalated: "Site office alerts",
    eyebrow: "Operations health",
    failed: "Final failures",
    freshAt: "Data refreshed",
    generatedQr: "Generated QR",
    inventoryGroup: "QR operations",
    line1: "Operations monitoring",
    line2: "Contact, delivery, and QR signals",
    noTrendData: "No operational events were recorded in this period.",
    liveStatus: "Live status",
    liveUpdating: "Latest operational snapshot",
    manualGates: "On-site checks",
    manualGatesDescription:
      "Real-device scanning, accessibility, contrast, and physical print quality remain operator checks.",
    medianResponse: "Median owner response",
    missingCost: "sent deliveries without recorded cost",
    openReports: "Open reports",
    outputReadyBatches: "Output-ready batches",
    pendingActivation: "Pending activation",
    period: "Trend period",
    periodCustom: "Custom range",
    periodToday: "Today",
    pageNext: "Next page",
    pagePrevious: "Previous page",
    pageSize: "Rows per page",
    paginationLabel: "Managed location pagination",
    qrConsole: "Open QR operations",
    qrSnapshotDescription: "Same authorized scope as the QR console.",
    reviewChecks: "Review checks",
    retrying: "Retrying",
    safetyGroup: "Safety and review",
    sent: "Sent or delivered",
    siteCount: "Authorized sites",
    siteComparison: "Managed-location comparison",
    siteComparisonDescription:
      "Prioritize locations by unresolved contacts, then open their authorized workspace.",
    startDate: "Start date",
    endDate: "End date",
    totalSites: "{start}-{end} of {total} locations",
    scope: "Current data scope",
    scopeAll: "All authorized locations",
    secondsUnit: "s",
    trend: "Contact and delivery trend",
    trendDescription: "Daily request, unresolved, sent, and failed counts for the selected period.",
    todayGroup: "Last 24 hours",
    totalQr: "Total QR",
    workQueue: "Current work queue",
    workQueueDescription:
      "Source-backed contact, escalation, delivery-failure, and report-review work within the selected scope.",
    workQueueEmpty: "There are no source-backed items requiring attention in this scope.",
    workQueueUnavailable: "The current work queue is not available yet.",
    workQueueCount: "{count} items",
    workType: "Work type",
    workLocation: "Management company / site",
    workStatus: "Current status",
    workElapsed: "Elapsed",
    workLastAttempt: "Last attempt",
    workAssignee: "Assignee",
    workActions: "Actions",
    workAcknowledge: "Acknowledge",
    workAssignSelf: "Assign to me",
    workStart: "Start",
    workResolve: "Resolve",
    workRetry: "Retry",
    workDefaultReason: "Operator updated the work queue state.",
    workPriority: "Priority",
    workSla: "SLA",
    workUnassigned: "Unassigned",
    workNotSet: "Not set",
    workOpen: "Open",
    workKinds: {
      CONTACT_REQUEST: "Contact request",
      ESCALATION: "Escalation",
      NOTIFICATION_FAILURE: "Notification failure",
      REPORT_REVIEW: "Report review",
      UNANSWERED_CONTACT: "Unanswered contact",
    },
    workStatuses: {
      CALLER_VIEWED: "Caller viewed",
      CREATED: "Created",
      ESCALATED: "Escalated",
      FAILED_FINAL: "Final failure",
      FAILED_RETRYABLE: "Retryable failure",
      MESSAGE_SUBMITTED: "Message submitted",
      NOTIFICATION_QUEUED: "Notification queued",
      OPEN: "Open",
      OWNER_NOTIFIED: "Owner notified",
      OWNER_VIEWED: "Owner viewed",
    },
    workQueueStates: {
      ACKNOWLEDGED: "Acknowledged",
      ASSIGNED: "Assigned",
      IN_PROGRESS: "In progress",
      RESOLVED: "Resolved",
      RETRY_PENDING: "Retry pending",
      WAITING: "Waiting",
    },
    unresolved: "Unresolved requests",
    unavailableDescription:
      "The approved operations data source is temporarily unavailable. No operational figures are shown until it recovers.",
    unavailableTitle: "Operations data is temporarily unavailable",
  },
  ko: {
    activeBlocks: "활성 방문자 차단",
    activeQr: "활성 QR",
    apply: "적용",
    back: "대시보드로 돌아가기",
    batches: "완료된 QR 제작 묶음",
    contactCount: "차량 연락 요청",
    cost: "기록된 발송 비용",
    comparePrevious: "이전 기간과 비교",
    comparePreviousActive: "이전 기간과 비교 중",
    days: "일",
    description:
      "승인된 관리 현장 범위에서 최근 24시간의 연락, 알림, 안전 검토와 QR 운영 신호를 확인합니다.",
    detail: "현장 보기",
    deliveryGroup: "알림 전달",
    emptySites: "선택한 범위에 표시할 운영 현장이 없습니다.",
    escalated: "관리사무소 알림",
    eyebrow: "운영 건전성",
    failed: "최종 실패",
    freshAt: "데이터 기준 시각",
    generatedQr: "생성된 QR",
    inventoryGroup: "QR 운영",
    line1: "운영 모니터링",
    line2: "연락·전송·QR 운영 신호",
    noTrendData: "선택한 기간에 기록된 운영 이벤트가 없습니다.",
    liveStatus: "실시간 상태",
    liveUpdating: "최신 운영 스냅샷",
    manualGates: "현장 확인 항목",
    manualGatesDescription:
      "실기기 스캔, 접근성, 화면 대비와 실제 인쇄 품질은 운영자가 확인합니다.",
    medianResponse: "차주 응답 중앙값",
    missingCost: "비용이 기록되지 않은 발송 건",
    openReports: "미처리 신고",
    outputReadyBatches: "출력 준비 묶음",
    pendingActivation: "활성화 대기",
    period: "추이 기간",
    periodCustom: "기간 설정",
    periodToday: "오늘",
    pageNext: "다음 페이지",
    pagePrevious: "이전 페이지",
    pageSize: "페이지당 표시",
    paginationLabel: "관리 현장 페이지 이동",
    qrConsole: "QR 운영 관리 열기",
    qrSnapshotDescription: "QR 운영 관리와 동일한 승인 범위입니다.",
    reviewChecks: "점검 항목 보기",
    retrying: "재시도 중",
    safetyGroup: "안전·검토",
    sent: "전송·도달",
    siteCount: "관리 현장",
    siteComparison: "관리 현장별 비교",
    siteComparisonDescription:
      "미해결 연락이 많은 현장을 우선 확인하고 승인된 현장 화면으로 이동합니다.",
    startDate: "시작일",
    endDate: "종료일",
    totalSites: "{start}-{end} / 총 {total}개 현장",
    scope: "현재 데이터 범위",
    scopeAll: "승인된 전체 관리 현장",
    secondsUnit: "초",
    trend: "연락·알림 추이",
    trendDescription: "선택한 기간의 일별 요청, 미해결, 전송, 실패 건수를 비교합니다.",
    todayGroup: "최근 24시간",
    totalQr: "전체 QR",
    workQueue: "현재 업무 큐",
    workQueueDescription:
      "선택한 범위의 실제 연락·에스컬레이션·알림 실패·신고 검토 업무만 표시합니다.",
    workQueueEmpty: "현재 범위에 처리 대기 중인 실제 업무가 없습니다.",
    workQueueUnavailable: "현재 업무 큐를 불러올 수 없습니다.",
    workQueueCount: "총 {count}건",
    workType: "업무 유형",
    workLocation: "관리회사 / 사이트",
    workStatus: "현재 상태",
    workElapsed: "경과 시간",
    workLastAttempt: "마지막 시도",
    workAssignee: "담당자",
    workActions: "업무 처리",
    workAcknowledge: "확인",
    workAssignSelf: "내게 배정",
    workStart: "처리 시작",
    workResolve: "해결",
    workRetry: "재시도 대기",
    workDefaultReason: "운영자가 업무 큐 상태를 갱신했습니다.",
    workPriority: "우선순위",
    workSla: "SLA",
    workUnassigned: "미지정",
    workNotSet: "설정되지 않음",
    workOpen: "열기",
    workKinds: {
      CONTACT_REQUEST: "차량 연락 요청",
      ESCALATION: "에스컬레이션",
      NOTIFICATION_FAILURE: "알림 실패",
      REPORT_REVIEW: "신고 검토",
      UNANSWERED_CONTACT: "미응답",
    },
    workStatuses: {
      CALLER_VIEWED: "요청자 확인",
      CREATED: "생성됨",
      ESCALATED: "에스컬레이션",
      FAILED_FINAL: "최종 실패",
      FAILED_RETRYABLE: "재시도 가능",
      MESSAGE_SUBMITTED: "요청 접수",
      NOTIFICATION_QUEUED: "알림 대기",
      OPEN: "검토 대기",
      OWNER_NOTIFIED: "차주 알림 완료",
      OWNER_VIEWED: "차주 확인",
    },
    workQueueStates: {
      ACKNOWLEDGED: "확인됨",
      ASSIGNED: "배정됨",
      IN_PROGRESS: "처리 중",
      RESOLVED: "해결됨",
      RETRY_PENDING: "재시도 대기",
      WAITING: "대기",
    },
    unresolved: "미해결 요청",
    unavailableDescription:
      "승인된 운영 데이터 원본에 일시적으로 연결할 수 없습니다. 복구될 때까지 운영 수치를 임의로 표시하지 않습니다.",
    unavailableTitle: "운영 데이터를 불러올 수 없습니다",
  },
});
