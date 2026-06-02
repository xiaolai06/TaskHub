'use client';

import { useState, useEffect } from 'react';
import {
  Pencil, Trash2, Users, Mail, Phone, Building2,
  MapPin, FolderKanban, Briefcase, Calendar, StickyNote, DollarSign,
  CheckCircle2, Clock, ChevronRight, ChevronDown,
} from 'lucide-react';
import type { Customer, CreateCustomerInput, CustomerProject } from '@/hooks/useCustomers';
import { CustomerForm } from './CustomerForm';

/** 客户状态配置 */
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: '合作中', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  VIP: { label: '重点客户', color: 'text-amber-700', bg: 'bg-amber-50' },
  LEAD: { label: '待跟进', color: 'text-blue-700', bg: 'bg-blue-50' },
  INACTIVE: { label: '已暂停', color: 'text-slate-500', bg: 'bg-slate-100' },
};

/** 项目状态标签 */
const PROJECT_ST: Record<string, { label: string; dot: string }> = {
  ACTIVE: { label: '进行中', dot: 'bg-emerald-400' },
  COMPLETED: { label: '已完成', dot: 'bg-blue-400' },
  ARCHIVED: { label: '已归档', dot: 'bg-slate-300' },
};

/** 沟通类型标签 */
const CONTACT_TYPE: Record<string, string> = {
  EMAIL: '邮件', PHONE: '电话', MEETING: '会议', CHAT: '聊天', OTHER: '其他',
};

/** 金额格式化：分 → 元 */
function formatMoney(fen: number) {
  if (fen >= 10000 * 100) return `¥${(fen / 10000 / 100).toFixed(1)}万`;
  if (fen >= 1000 * 100) return `¥${(fen / 1000 / 100).toFixed(1)}千`;
  return `¥${(fen / 100).toLocaleString()}`;
}

/** 相对时间 */
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days}天前`;
  if (days < 365) return `${Math.floor(days / 30)}个月前`;
  return `${Math.floor(days / 365)}年前`;
}

/** 日期格式化 */
function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 项目卡片 */
function ProjectCard({ project }: { project: CustomerProject }) {
  const pst = PROJECT_ST[project.status] ?? PROJECT_ST.ACTIVE;
  const progress = project.taskCount > 0
    ? Math.round((project.completedTaskCount / project.taskCount) * 100)
    : 0;
  return (
    <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3.5">
      {/* 项目头 */}
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${pst.dot}`} />
        <span className="text-sm font-medium text-slate-800">{project.name}</span>
        <span className="text-[11px] text-slate-500">{pst.label}</span>
        {project.type && (
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
            {project.type}
          </span>
        )}
      </div>
      {/* 财务 + 进度 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {project.budget != null && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-slate-400" />
            预算 {formatMoney(project.budget)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-red-300" />
          已花费 {formatMoney(project.usedBudget)}
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-slate-400" />
          任务 {project.completedTaskCount}/{project.taskCount}
          {project.taskCount > 0 && (
            <span className="text-slate-300">({progress}%)</span>
          )}
        </span>
      </div>
      {/* 报酬说明 / 支出说明 */}
      {(project.rewardNote || project.expenseNote) && (
        <div className="mt-2 space-y-0.5 text-xs text-slate-400">
          {project.rewardNote && <p>💬 报酬: {project.rewardNote}</p>}
          {project.expenseNote && <p>📝 支出: {project.expenseNote}</p>}
        </div>
      )}
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
  /** 外部触发打开添加表单（值变化时打开） */
  formOpenTrigger?: number;
}

export function CustomerList({
  customers, isLoading, error,
  onCreate, onUpdate, onDelete, createLoading, updateLoading,
  total, formCloseTrigger, formOpenTrigger,
}: CustomerListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  function toggleProjects(customerId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.has(customerId) ? next.delete(customerId) : next.add(customerId);
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

  // 打开表单时自动重置
  useEffect(() => {
    if (!showForm) setEditCustomer(null);
  }, [showForm]);

  function handleEdit(c: Customer) { setEditCustomer(c); setShowForm(true); }
  function handleSubmit(data: CreateCustomerInput) {
    editCustomer ? onUpdate(editCustomer.id, data) : onCreate(data);
  }
  function handleDelete(id: string, name: string) {
    if (confirm(`确定要删除客户「${name}」吗？`)) onDelete(id);
  }
  function handleFormClose() { setShowForm(false); setEditCustomer(null); }

  // 加载态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }
  // 错误态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <Users className="h-6 w-6 text-red-300" />
        </div>
        <p className="text-sm font-medium text-red-500">加载客户列表失败</p>
        <button onClick={() => window.location.reload()} className="mt-3 text-sm font-medium text-indigo-600 hover:underline">重试</button>
      </div>
    );
  }

  return (
    <>
      {/* 空状态 */}
      {!customers.length ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200/60 bg-white py-24 shadow-sm">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50">
            <Users className="h-7 w-7 text-slate-200" />
          </div>
          <p className="text-sm font-medium text-slate-500">暂无客户</p>
          <p className="mt-1 text-xs text-slate-400">添加您的第一个客户开始管理</p>
          <button onClick={() => { setEditCustomer(null); setShowForm(true); }} className="mt-4 text-sm font-medium text-indigo-600 hover:underline">添加客户</button>
        </div>
      ) : (
        /* 客户卡片列表 */
        <div className="space-y-4">
          {customers.map((c) => {
            const st = STATUS_MAP[c.status] ?? STATUS_MAP.ACTIVE;
            return (
              <div key={c.id} className="group rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md">
                {/* ── 第一行：名称 + 状态 + 操作 ── */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-base font-bold text-indigo-600">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-slate-800">{c.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.color} ${st.bg}`}>{st.label}</span>
                      </div>
                      {c.company && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          {c.company}
                          {c.industry && <span className="ml-1 flex items-center gap-1 text-slate-400">· <Briefcase className="h-3 w-3" />{c.industry}</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => handleEdit(c)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600" title="编辑"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(c.id, c.name)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500" title="删除"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {/* ── 第二行：联系信息 ── */}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500">
                  {c.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" />{c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" />{c.phone}</span>}
                  {c.address && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" />{c.address}</span>}
                  <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-slate-400" />创建于 {formatDate(c.createdAt)}</span>
                </div>

                {/* ── 关联项目（可展开） ── */}
                {c.projects && c.projects.length > 0 ? (
                  <div className="mt-3">
                    <button
                      onClick={() => toggleProjects(c.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-600 transition-colors hover:text-indigo-600"
                    >
                      {expandedProjects.has(c.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <FolderKanban className="h-3.5 w-3.5" />
                      关联项目 ({c.projects.length})
                    </button>
                    {expandedProjects.has(c.id) && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {c.projects.map((p) => <ProjectCard key={p.id} project={p} />)}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* ── 沟通记录 + 备注 ── */}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
                  {c.lastContactAt ? (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      上次沟通: {CONTACT_TYPE[c.lastContactType ?? ''] ?? '沟通'} · {timeAgo(c.lastContactAt)}
                      <span className="text-slate-300">（共 {c._count?.communications ?? 0} 次）</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Clock className="h-3.5 w-3.5" />暂无沟通记录
                    </span>
                  )}
                  {c.nextFollowAt && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-amber-400" />
                      下次跟进: {formatDate(c.nextFollowAt)}
                    </span>
                  )}
                </div>

                {/* ── 备注 ── */}
                {c.notes && (
                  <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-50/50 px-3 py-2 text-xs text-slate-500">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    {c.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 表单弹窗 */}
      <CustomerForm
        open={showForm}
        onClose={handleFormClose}
        onSubmit={handleSubmit}
        isLoading={editCustomer ? updateLoading : createLoading}
        editCustomer={editCustomer}
      />
    </>
  );
}
