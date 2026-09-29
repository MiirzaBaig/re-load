/** Keep a live customer's store context when restarting the return flow. */
export function getReturnStartPath() {
  const code = sessionStorage.getItem("relod-return-code");
  return code ? `/return?store=${encodeURIComponent(code)}` : "/return";
}
