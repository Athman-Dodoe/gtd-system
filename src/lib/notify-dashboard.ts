export function notifyDashboardRefresh() {
  window.dispatchEvent(new Event('dashboard:refresh'))
}
