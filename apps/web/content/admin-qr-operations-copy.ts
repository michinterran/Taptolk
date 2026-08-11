import type { AppLocale } from "../i18n/config";

export interface AdminQrOperationsCopy {
  approvalWorkflow: string;
  approvalWorkflowDescription: string;
  activeQr: string;
  addressEmpty: string;
  allCompanies: string;
  applyPageSize: string;
  applyQuantity: string;
  batch: string;
  batchOperations: string;
  batchPlan: string;
  company: string;
  completedBatches: string;
  confirmed: string;
  confirmSelection: string;
  description: string;
  directQuantity: string;
  downloadPending: string;
  downloadPendingDescription: string;
  downloadSvg: string;
  editSelection: string;
  empty: string;
  emptyCompany: string;
  emptySite: string;
  eyebrow: string;
  finalReview: string;
  finalReviewDescription: string;
  flowDescription: string;
  flowEyebrow: string;
  flowTitle: string;
  generatedQr: string;
  generationPolicy: string;
  hiddenReason: string;
  issue: string;
  operationsPanel: string;
  operationsPanelDescription: string;
  page: string;
  pageSize: string;
  pendingActivation: string;
  previous: string;
  progressDescription: string;
  progressEmpty: string;
  progressPending: string;
  progressFailed: string;
  progressOutput: string;
  progressQuality: string;
  progressRendered: string;
  progressTitle: string;
  quantity: string;
  quantityDecrease: string;
  quantityFastAdjust: string;
  quantityHelp: string;
  quantityIncrease: string;
  quantityLimit: string;
  quantityMax: string;
  quantityMin: string;
  quantityPresets: string;
  requestQuantity: string;
  reviewAndGenerate: string;
  reviewSummary: string;
  next: string;
  refreshProgress: string;
  readyDownload: string;
  scopePanel: string;
  selectScope: string;
  selectedCompany: string;
  selectedSite: string;
  splitPlan: string;
  stepDone: string;
  stepLocked: string;
  site: string;
  status: string;
  statusLabels: Readonly<Record<string, string>>;
  stepProgress: string;
  stepQuantity: string;
  stepScope: string;
  steps: readonly string[];
  tableRange: string;
  tableSummary: string;
  title: string;
  totalBatches: string;
  totalCompanies: string;
  totalQr: string;
  workflowState: string;
}

export const ADMIN_QR_OPERATIONS_COPY: Readonly<Record<AppLocale, AdminQrOperationsCopy>> =
  Object.freeze({
    en: {
      approvalWorkflow: "Open design and approval",
      approvalWorkflowDescription:
        "Use the gated sample and final approval flow before production generation.",
      activeQr: "Active QR",
      addressEmpty: "Address not registered",
      allCompanies: "All management companies",
      applyPageSize: "Apply page size",
      applyQuantity: "Apply",
      batch: "Batch",
      batchOperations: "QR batch operations",
      batchPlan: "Batch plan",
      company: "Management company",
      completedBatches: "Completed batches",
      confirmed: "Scope confirmed",
      confirmSelection: "Confirm this company and site",
      description:
        "Generate unique dynamic QR codes by management company and site, then monitor generation, SVG output, activation, and operating status.",
      directQuantity: "Direct quantity",
      downloadPending: "Preparing",
      downloadPendingDescription:
        "SVG downloads become available here after every batch output is ready.",
      downloadSvg: "SVG download",
      editSelection: "Edit",
      empty: "No QR batches are available for the current scope.",
      emptyCompany: "No management company",
      emptySite: "No site",
      eyebrow: "Admin-only QR operations",
      finalReview: "Final request",
      finalReviewDescription:
        "Review the confirmed company, site, quantity, and server batch split before creating QR codes.",
      flowDescription:
        "Confirm the management company and site first. After the scope is fixed, choose a quantity and create QR batches without using a design wizard.",
      flowEyebrow: "QR creation flow",
      flowTitle: "Create QR codes by confirmed company and site",
      generatedQr: "Generated QR",
      generationPolicy: "Admin direct generation",
      hiddenReason: "Admin direct QR generation request",
      issue: "Generate QR",
      operationsPanel: "QR operations",
      operationsPanelDescription:
        "Review generated quantities, processing progress, output readiness, and download availability by batch.",
      page: "{current} / {total} pages",
      pageSize: "Rows per page",
      pendingActivation: "Pending activation",
      previous: "Previous",
      progressDescription:
        "The generation worker updates this progress as unique QR assets and SVG output are produced.",
      progressEmpty: "No generation request is being tracked on this screen yet.",
      progressPending:
        "The generation request was accepted. Progress will appear when the batch record is ready.",
      progressFailed: "Failed",
      progressOutput: "SVG output",
      progressQuality: "Quality passed",
      progressRendered: "Rendered",
      progressTitle: "Latest generation progress",
      quantity: "Generation quantity",
      quantityDecrease: "Decrease quantity",
      quantityFastAdjust: "Fast adjustment",
      quantityHelp:
        "Choose a preset for fast work or enter a direct quantity from 1 to 10,000. Large requests are split into 100-code batches on the server.",
      quantityIncrease: "Increase quantity",
      quantityLimit: "Allowed range",
      quantityMax: "Max",
      quantityMin: "Min",
      quantityPresets: "Quantity presets",
      requestQuantity: "{count} QR codes will be requested.",
      reviewAndGenerate: "Review and generate",
      reviewSummary: "Request summary",
      next: "Next",
      refreshProgress: "Refresh progress",
      readyDownload: "Download ready",
      scopePanel: "Company and site selection",
      selectScope: "Review selection",
      selectedCompany: "Selected management company",
      selectedSite: "Selected site",
      splitPlan: "{count} QR codes · {batches} server batches · last batch {last} codes",
      stepDone: "Done",
      stepLocked: "Locked",
      site: "Site",
      status: "Status",
      statusLabels: {
        CANCELLED: "Cancelled",
        COMPLETED: "Completed",
        DELIVERED: "Delivered",
        DISTRIBUTING: "Distributing",
        DRAFT: "Draft",
        FAILED: "Failed",
        FINAL_APPROVAL_PENDING: "Final approval pending",
        GENERATED: "Generated",
        GENERATING: "Generating",
        GENERATION_APPROVED: "Generation approved",
        GENERATION_QUEUED: "Queued",
        PARTIALLY_COMPLETED: "Partially completed",
        PRINTED: "Printed",
        PRINT_FILE_READY: "Print file ready",
        QUALITY_CHECKED: "Quality checked",
        SAMPLE_APPROVED: "Sample approved",
        SAMPLE_READY: "Sample ready",
        SAMPLE_RENDERING: "Sample rendering",
        SENT_TO_PRINTER: "Sent to printer",
        SHIPPED: "Shipped",
      },
      stepProgress: "Progress",
      stepQuantity: "Quantity",
      stepScope: "Scope",
      steps: ["Select scope", "Confirm and generate", "Progress", "Download"],
      tableRange: "{start}-{end} of {total} batches",
      tableSummary: "Batch table summary",
      title: "QR operations",
      totalBatches: "Batches",
      totalCompanies: "Companies",
      totalQr: "Total QR",
      workflowState: "Workflow state",
    },
    ko: {
      approvalWorkflow: "디자인·승인 작업면 열기",
      approvalWorkflowDescription: "제작 전 샘플 검토와 최종 승인 흐름을 먼저 진행합니다.",
      activeQr: "활성 QR",
      addressEmpty: "주소 미등록",
      allCompanies: "전체 관리회사",
      applyPageSize: "표시 개수 적용",
      applyQuantity: "적용",
      batch: "발행 묶음",
      batchOperations: "QR 발행 묶음 운영",
      batchPlan: "생성 묶음 계획",
      company: "관리회사",
      completedBatches: "완료 묶음",
      confirmed: "범위 확인 완료",
      confirmSelection: "이 관리회사와 사이트로 확정",
      description:
        "관리회사와 사이트 기준으로 중복 없는 동적 QR을 생성하고, SVG 출력·활성화·운영 상태를 한 화면에서 관리합니다.",
      directQuantity: "직접 수량",
      downloadPending: "준비 중",
      downloadPendingDescription:
        "모든 발행 묶음의 SVG 출력이 준비되면 이 단계에서 다운로드할 수 있습니다.",
      downloadSvg: "SVG 다운로드",
      editSelection: "수정",
      empty: "현재 범위에 표시할 QR 발행 묶음이 없습니다.",
      emptyCompany: "관리회사 없음",
      emptySite: "사이트 없음",
      eyebrow: "어드민 전용 QR 운영",
      finalReview: "최종 요청",
      finalReviewDescription:
        "확정한 관리회사, 사이트, 생성 수량과 서버 분할 묶음을 확인한 뒤 QR 생성을 요청합니다.",
      flowDescription:
        "먼저 관리회사와 사이트를 확인합니다. 범위가 확정된 뒤 수량을 정하고 디자인 위자드 없이 QR 발행 묶음을 생성합니다.",
      flowEyebrow: "QR 생성 플로우",
      flowTitle: "확정된 관리회사와 사이트 기준으로 QR을 생성합니다",
      generatedQr: "생성된 QR",
      generationPolicy: "어드민 직접 생성",
      hiddenReason: "어드민 QR 직접 발행 요청",
      issue: "QR 생성",
      operationsPanel: "QR 운영",
      operationsPanelDescription:
        "발행 묶음별 생성 수량, 처리 진행률, 출력 준비 여부와 다운로드 가능 상태를 확인합니다.",
      page: "{current} / {total} 페이지",
      pageSize: "페이지당 표시",
      pendingActivation: "활성화 대기",
      previous: "이전",
      progressDescription: "worker가 고유 QR 자산과 SVG 출력을 만들면서 진행률이 갱신됩니다.",
      progressEmpty: "아직 이 화면에서 추적 중인 생성 요청이 없습니다.",
      progressPending: "생성 요청을 접수했습니다. 발행 묶음이 준비되면 진행률을 표시합니다.",
      progressFailed: "실패",
      progressOutput: "SVG 출력",
      progressQuality: "품질 통과",
      progressRendered: "렌더링",
      progressTitle: "최근 생성 진행률",
      quantity: "생성 수량",
      quantityDecrease: "수량 줄이기",
      quantityFastAdjust: "빠른 조정",
      quantityHelp:
        "빠른 프리셋을 선택하거나 1~10,000 사이 수량을 직접 입력합니다. 큰 요청은 서버에서 100개 단위 묶음으로 나뉩니다.",
      quantityIncrease: "수량 늘리기",
      quantityLimit: "허용 범위",
      quantityMax: "최대",
      quantityMin: "최소",
      quantityPresets: "수량 프리셋",
      requestQuantity: "{count}개의 QR 생성을 요청합니다.",
      reviewAndGenerate: "최종 확인 후 생성",
      reviewSummary: "요청 요약",
      next: "다음",
      refreshProgress: "진행률 새로고침",
      readyDownload: "다운로드 준비 완료",
      scopePanel: "관리회사와 사이트 선택",
      selectScope: "선택 검토",
      selectedCompany: "선택한 관리회사",
      selectedSite: "선택한 사이트",
      splitPlan: "{count}개 QR · 서버 {batches}묶음 · 마지막 묶음 {last}개",
      stepDone: "완료",
      stepLocked: "대기",
      site: "사이트",
      status: "상태",
      statusLabels: {
        CANCELLED: "취소됨",
        COMPLETED: "완료",
        DELIVERED: "배송 완료",
        DISTRIBUTING: "배포 중",
        DRAFT: "초안",
        FAILED: "실패",
        FINAL_APPROVAL_PENDING: "최종 승인 대기",
        GENERATED: "생성 완료",
        GENERATING: "생성 중",
        GENERATION_APPROVED: "생성 승인됨",
        GENERATION_QUEUED: "생성 대기",
        PARTIALLY_COMPLETED: "일부 완료",
        PRINTED: "출력 완료",
        PRINT_FILE_READY: "출력 파일 준비",
        QUALITY_CHECKED: "품질 확인",
        SAMPLE_APPROVED: "샘플 승인됨",
        SAMPLE_READY: "샘플 준비",
        SAMPLE_RENDERING: "샘플 생성 중",
        SENT_TO_PRINTER: "출력 전달",
        SHIPPED: "배송 중",
      },
      stepProgress: "진행",
      stepQuantity: "수량",
      stepScope: "범위",
      steps: ["범위 선택", "확인 후 생성", "진행률", "다운로드"],
      tableRange: "총 {total}묶음 중 {start}-{end}",
      tableSummary: "발행 묶음 표 요약",
      title: "QR 운영 관리",
      totalBatches: "발행 묶음",
      totalCompanies: "관리회사",
      totalQr: "전체 QR",
      workflowState: "진행 상태",
    },
  });
