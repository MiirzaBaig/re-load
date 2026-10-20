import Link from "next/link";
import { notFound } from "next/navigation";
import { SOLUTIONS } from "@/lib/public-solutions";
import { SITE_URL, pageMetadata } from "@/lib/public-site";
export function generateStaticParams() {
  return (["ar", "en"] as const).flatMap(locale=>SOLUTIONS.map(s=>({locale,feature:s.slug})));
}
async function resolve(params: Promise<{locale:string;feature:string}>) {
  const {locale,feature}=await params;
  if(locale!=="ar"&&locale!=="en") notFound();
  const solution=SOLUTIONS.find(s=>s.slug===feature);
  if(!solution)notFound();
  return {locale,solution,i:locale==="ar"?1:0} as const;
}
export async function generateMetadata({params}:{params:Promise<{locale:string;feature:string}>}) {
  const {locale,solution,i}=await resolve(params);
  return pageMetadata(locale,l=>`/${l}/solutions/${solution.slug}`,{title:`${solution.title[i]} | ${i?"ريلود":"Reload"}`,description:solution.description[i]});
}
export default async function Page({params}:{params:Promise<{locale:string;feature:string}>}) {
  const {locale,solution:s,i}=await resolve(params);
  const url = `${SITE_URL}/${locale}/solutions/${s.slug}`;
  const schema = {"@context":"https://schema.org","@graph":[{"@type":"WebPage","@id":url,name:s.title[i],description:s.description[i],url,inLanguage:locale==="ar"?"ar-SA":"en"},{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:i?"ريلود":"Reload",item:`${SITE_URL}/${locale}`},{"@type":"ListItem",position:2,name:s.title[i],item:url}]}]};
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,"\\u003c")}}/><article className="mx-auto max-w-4xl px-5 py-14 sm:py-24"><Link href={`/${locale}#integrations`} className="text-sm text-muted-foreground underline underline-offset-4">{i?"العودة إلى الحلول":"Back to solutions"}</Link><p className="mt-12 text-sm text-muted-foreground">{s.title[i]}</p><h1 className="mt-4 font-display text-4xl font-semibold leading-snug tracking-tight sm:text-5xl">{s.headline[i]}</h1><p className="mt-6 max-w-2xl text-lg leading-9 text-muted-foreground">{s.description[i]}</p><ol className="my-12 grid gap-4 sm:grid-cols-3">{s.steps.map((step,n)=><li key={n} className="rounded-2xl border bg-card p-5"><span className="text-xs text-muted-foreground">0{n+1}</span><h2 className="mt-4 text-base font-semibold">{step[i]}</h2></li>)}</ol><h2 className="text-xl font-semibold">{i?"كيف يعمل؟":"How it works"}</h2><p className="mt-4 leading-8 text-muted-foreground">{s.detail[i]}</p><aside className="mt-8 rounded-2xl border bg-muted/40 p-6"><h2 className="text-sm font-semibold">{i?"ما تحتاج تعرفه قبل البدء":"What to know before you start"}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{s.boundary[i]}</p></aside><div className="mt-10 flex flex-wrap gap-4"><Link href={s.slug==="shipping"?`/${locale}#contact`:"/auth"} className="rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-background">{s.slug==="shipping"?(i?"تواصل مع الفريق":"Contact the team"):(i?"جهّز متجرك":"Set up your store")}</Link><Link href={`/${locale}/pricing`} className="rounded-xl border px-6 py-3 text-sm font-medium">{i?"عرض الأسعار":"View pricing"}</Link></div></article></>;
}
