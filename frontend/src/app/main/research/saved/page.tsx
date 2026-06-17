// 此路由已废弃，所有功能在 /main/research 页面的 Tab 中
// 保留文件避免 Next.js 路由冲突
import { redirect } from 'next/navigation';

export default function ResearchSavedPage() {
  redirect('/main/research');
}
