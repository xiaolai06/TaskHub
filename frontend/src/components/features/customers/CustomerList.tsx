'use client';

import { useEffect, useState } from 'react';
import { Building2, Briefcase, Calendar, CheckCircle2, ChevronDown, ChevronRight, Clock, DollarSign, FolderKanban, Mail, MapPin, Pencil, Phone, StickyNote, Trash2, Users } from 'lucide-react';
import type { Customer, CreateCustomerInput, CustomerProject } from '@/hooks/useCustomers';
import { CustomerForm } from './CustomerForm';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: '合作中', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  VIP: { label: '重点客户', color: 'text-amber-700', bg: 'bg-amber-50' },
  LEAD: { label: '待跟进', color: 'text-blue-700', bg: 'bg-blue-50' },
  INACTIVE: { label: '已暂停', color: 'text-slate-500', bg: 'bg-slate-100' },
};

const PROJECT_STATUS: Record<string, { label: string; dot: string }> = {
  ACTIVE: { label: '进行中', dot: 'bg-emerald-400' },
  COMPLETED: { label: '已完成', dot: 'bg-blue-400' },
  ARCHIVED: { label: '已归档', dot: 'bg-slate-300' },
};

const CONTACT_TYPE: Record<string, string> = { EMAIL: '邮件', PHONE: '电话', MEETING: '会议', CHAT: '聊天', OTHER: '其他' };

function formatMoney(fen: number) {
  const yuan = fen / 100;
  if (yuan >= 10000) return `¥${(yuan / 10000).toFixed(1)}w`;
  return `¥${yuan.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.max(0, Math.floor(diff / 86400000));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ProjectCard({ project }: { project: CustomerProject }) {
  const status = PROJECT_STATUS[project.status] ?? PROJECT_STATUS.ACTIVE;
  const progress = project.taskCount > 0 ? Math.round((project.completedTaskCount / project.taskCount) * 100) : 0;
  const quote = project.budget ?? 0;
  const profit = quote - project.usedBudget;

  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3.5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${status.dot}`} />
        <span className="text-sm font-medium text-slate-800">{project.name}</span>
        <span className="text-[11px] text-slate-400">{status.label}</span>
        {project.type && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">{project.type}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-slate-400" />报价 {formatMoney(quote)}</span>
        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-red-300" />成本 {formatMoney(project.usedBudget)}</span>
        <span className={`flex items-center gap-1 ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}><DollarSign className="h-3 w-3" />利润 {formatMoney(profit)}</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-slate-400" />任务 {project.completedTaskCount}/{project.taskCount}{project.taskCount > 0 && <span className="text-slate-300">({progress}%)</span>}</span>
      </div>
      {project.expenseNote && <div className="mt-2 text-xs text-slate-400">成本备注：{project.expenseNote}</div>}
    </div>
  );
}

interface CustomerListProps {
  customers: Customer[];
  isLoading?: boolean;
  error?: boolean;
  onCreate: (data: CreateCustomerInput) => void;
  onUpdate: (id: string, data: CreateCustomerInput) => void;
  onDelete: (id: string) => void;
  createLoading?: boolean;
  updateLoading?: boolean;
  total: number;
  formCloseTrigger?: number;
  formOpenTrigger?: number;
}

export function CustomerList({ customers, isLoading, error, onCreate, onUpdate, onDelete, createLoading, updateLoading, formCloseTrigger, formOpenTrigger }: CustomerListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  function toggleProjects(customerId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  useEffect(() => {
    if (formCloseTrigger && formCloseTrigger > 0) {
      setShowForm(false);
      setEditCustomer(null);
    }
  }, [formCloseTrigger]);

  useEffect(() => {
    if (formOpenTrigger) {
      setEditCustomer(null);
      setShowForm(true);
    }
  }, [formOpenTrigger]);

  useEffect(() => {
    if (!showForm) setEditCustomer(null);
  }, [showForm]);

  function handleEdit(customer: Customer) {
    setEditCustomer(customer);
    setShowForm(true);
  }

  function handleSubmit(data: CreateCustomerInput) {
    if (editCustomer) onUpdate(editCustomer.id, data);
    else onCreate(data);
  }

  function handleDelete(id: string, name: string) {
    if (confirm(`确定要删除客户「${name}」吗？`)) onDelete(id);
  }

  if (isLoading) return <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" /></div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50"><Users className="h-6 w-6 text-red-300" /></div>
        <p className="text-sm font-medium text-red-500">加载客户列表失败</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">重试</button>
      </div>
    );
  }

  return (
    <>
      {!customers.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-white py-24 shadow-sm">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50"><Users className="h-7 w-7 text-slate-200" /></div>
          <p className="text-sm font-medium text-slate-500">暂无客户</p>
          <p className="mt-1 text-xs text-slate-400">添加第一个客户，开始管理订单来源</p>
          <button type="button" onClick={() => { setEditCustomer(null); setShowForm(true); }} className="mt-4 text-sm font-medium text-indigo-600 hover:underline">添加客户</button>
        </div>
      ) : (
        <div className="space-y-4">
          {customers.map((customer) => {
            const status = STATUS_MAP[customer.status] ?? STATUS_MAP.ACTIVE;
            return (
              <div key={customer.id} className="group rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-base font-bold text-indigo-600">{customer.name.charAt(0)}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-slate-800">{customer.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.color} ${status.bg}`}>{status.label}</span>
                      </div>
                      {customer.company && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <Building2 className="h-3 w-3 text-slate-400" />{customer.company}
                          {customer.industry && <span className="ml-1 flex items-center gap-1 text-slate-400">· <Briefcase className="h-3 w-3" />{customer.industry}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => handleEdit(customer)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600" title="编辑"><Pencil className="h-4 w-4" /></button>
                    <button type="button" onClick={() => handleDelete(customer.id, customer.name)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500" title="删除"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
                  {customer.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" />{customer.email}</span>}
                  {customer.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" />{customer.phone}</span>}
                  {customer.address && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" />{customer.address}</span>}
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" />创建于 {formatDate(customer.createdAt)}</span>
                </div>

                {customer.projects && customer.projects.length > 0 && (
                  <div className="mt-3">
                    <button type="button" onClick={() => toggleProjects(customer.id)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 transition-colors hover:text-indigo-600">
                      {expandedProjects.has(customer.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <FolderKanban className="h-3.5 w-3.5" />关联订单 ({customer.projects.length})
                    </button>
                    {expandedProjects.has(customer.id) && <div className="mt-2 grid gap-2 sm:grid-cols-2">{customer.projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div>}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
                  {customer.lastContactAt ? (
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />上次沟通 {CONTACT_TYPE[customer.lastContactType ?? ''] ?? '沟通'} · {timeAgo(customer.lastContactAt)}<span className="text-slate-300">（共 {customer._count?.communications ?? 0} 次）</span></span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-300"><Clock className="h-3.5 w-3.5" />暂无沟通记录</span>
                  )}
                  {customer.nextFollowAt && <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-amber-400" />下次跟进: {formatDate(customer.nextFollowAt)}</span>}
                </div>

                {customer.notes && <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-50/50 px-3 py-2 text-xs text-slate-500"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />{customer.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      <CustomerForm open={showForm} onClose={() => { setShowForm(false); setEditCustomer(null); }} onSubmit={handleSubmit} isLoading={editCustomer ? updateLoading : createLoading} editCustomer={editCustomer} />
    </>
  );
}