/** Keep the customer's own words; never silently rewrite a complaint with AI. */
export function reviseTicketDraft(
  current: string,
  input: string,
): { kind: "EDIT" | "CONFIRM" | "REPLACE" | "APPEND"; text: string } {
  const value = input.trim();
  if (
    /^(edit_ticket|edit|change|rewrite|wait|wait[, ]*(change that|let me explain again)|let me (edit|rewrite|explain again)|عدّل|عدل|تعديل|لحظة|غير الرسالة|خلني أوضح)([.!؟?]*)$/i.test(
      value,
    )
  )
    return { kind: "EDIT", text: current };
  if (
    /^(yes|ok|okay|send|send it|نعم|اي|إيه|تمام|ارسل|أرسل)[.!؟?]*$/i.test(value)
  )
    return { kind: "CONFIRM", text: current };
  const extra = value.match(
    /^(?:add(?: this(?: detail)?)?|also add|أضف|اضف|زيد|وأضف)\s*[:،]?\s+([\s\S]+)$/i,
  );
  if (extra) return { kind: "APPEND", text: `${current}\n${extra[1]}` };
  return { kind: "REPLACE", text: value };
}
