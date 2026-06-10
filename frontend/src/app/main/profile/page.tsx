'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Lock, Loader2, CheckCircle, AlertCircle,
  Camera, Sparkles, MapPin, Building2, Globe, Phone,
  Cake, Star, Brain, Save,
} from 'lucide-react';

// ========== 常量 ==========

const avatarColors = [
  'bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-red-500', 'bg-pink-500', 'bg-purple-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-orange-500', 'bg-lime-500', 'bg-fuchsia-500',
];

const zodiacOptions = [
  '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座',
  '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座',
];

const mbtiOptions = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

const presetTags = [
  '🎨 设计达人', '💻 代码高手', '📊 数据分析', '🎯 目标导向',
  '🤝 团队协作', '🔥 效率狂人', '📝 细节控', '🚀 快速迭代',
  '☕ 咖啡续命', '🌙 夜猫子', '🐦 早起鸟', '🎮 游戏玩家',
  '📚 终身学习', '🎵 音乐爱好者', '🏃 运动达人', '🍜 美食家',
];

interface ProfileData {
  bio?: string;
  birthday?: string;
  zodiac?: string;
  mbti?: string;
  phone?: string;
  location?: string;
  company?: string;
  title?: string;
  website?: string;
  tags?: string;
  avatarType?: string;
  avatarValue?: string;
}

// ========== 页面 ==========

export default function ProfilePage() {
  const { user, setUser } = useAuth();

  // 基本信息
  const [name, setName] = useState(user?.name || '');
  const [avatarType, setAvatarType] = useState<'color' | 'image'>('color');
  const [avatarValue, setAvatarValue] = useState('bg-indigo-500');
  const [savedImage, setSavedImage] = useState(''); // 保存的图片，切换颜色后可恢复

  // 扩展资料
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [zodiac, setZodiac] = useState('');
  const [mbti, setMbti] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // 密码
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 状态
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载资料
  useEffect(() => {
    api.get<{ profile: ProfileData | null }>('/profile')
      .then((res) => {
        const p = res.profile;
        if (p) {
          setBio(p.bio || '');
          setBirthday(p.birthday ? p.birthday.split('T')[0] : '');
          setZodiac(p.zodiac || '');
          setMbti(p.mbti || '');
          setPhone(p.phone || '');
          setLocation(p.location || '');
          setCompany(p.company || '');
          setTitle(p.title || '');
          setWebsite(p.website || '');
          setTags(p.tags ? JSON.parse(p.tags) : []);
          setAvatarType((p.avatarType as 'color' | 'image') || 'color');
          setAvatarValue(p.avatarValue || 'bg-indigo-500');
          if (p.avatarType === 'image' && p.avatarValue) setSavedImage(p.avatarValue);
          // 同步 Header 用户数据
          if (user) setUser({ ...user, name: user.name, avatar: p.avatarValue || user.avatar });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 头像预览
  const initials = name ? name.slice(0, 2).toUpperCase() : 'U';

  // 切换标签
  function toggleTag(tag: string) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  // 自动保存（防抖 1 秒）
  const autoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      setSaved(false);
      try {
        // 同时更新 User 表（名字+头像）和 Profile 表（扩展资料）
        await Promise.all([
          api.put('/profile', {
            bio, birthday: birthday || undefined, zodiac, mbti,
            phone, location, company, title, website,
            tags, avatarType, avatarValue,
          }),
          api.put<{ user: { id: string; name: string; avatar: string | null; email: string; role: string } }>('/auth/profile', {
            name: name.trim(),
            avatar: avatarType === 'image' ? avatarValue : undefined,
          }),
        ]);
        // 同步 Header 用户数据
        if (user) {
          setUser({
            ...user,
            name: name.trim() || user.name,
            avatar: avatarType === 'image' ? avatarValue : user.avatar,
          });
        }
        setSaved(true);
      } catch {
        // 静默失败
      } finally {
        setSaving(false);
      }
    }, 1000);
  }, [name, bio, birthday, zodiac, mbti, phone, location, company, title, website, tags, avatarType, avatarValue, user, setUser]);

  // 已保存提示 3 秒后消失
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  // 任何字段变化触发自动保存
  useEffect(() => {
    if (!loading) autoSave();
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [bio, birthday, zodiac, mbti, phone, location, company, title, website, tags, avatarType, avatarValue, loading, autoSave]);

  // 修改密码
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: '两次输入的密码不一致' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: '新密码至少6位' });
      return;
    }
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      await api.put('/auth/password', { oldPassword, newPassword });
      setPasswordMsg({ type: 'success', text: '密码修改成功 🔒' });
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordMsg({ type: 'error', text: err instanceof Error ? err.message : '修改失败' });
    } finally {
      setSavingPassword(false);
    }
  }

  // 图片上传
  function handleImageUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = reader.result as string;
      setAvatarType('image');
      setAvatarValue(img);
      setSavedImage(img);
    };
    reader.readAsDataURL(file);
  }

  // 选择颜色
  function handleColorSelect(color: string) {
    setAvatarType('color');
    setAvatarValue(color);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>;
  }

  const inputCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';
  const selectCls = 'w-full rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200';

  return (
    <div className="mx-auto max-w-3xl space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">个人信息</h1>
        <div className="flex items-center gap-2 text-sm">
          {saving && <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />保存中...</span>}
          {saved && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle className="h-3.5 w-3.5" />已保存</span>}
        </div>
      </div>

      {/* ===== 头像 + 基本信息 ===== */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground/80">基本资料</h2>
        </div>
        <div className="px-6 py-5">
          {/* 头像 */}
          <div className="mb-6 flex items-start gap-5">
            <div className="relative">
              {avatarType === 'image' && avatarValue ? (
                <img src={avatarValue} alt="头像" className="h-24 w-24 rounded-full object-cover ring-2 ring-border" />
              ) : (
                <div className={cn('flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white', avatarValue)}>
                  {initials}
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-white shadow-md transition-colors hover:bg-indigo-700">
                <Camera className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                  e.target.value = '';
                }} />
              </label>
            </div>
            <div className="flex-1">
              <p className="mb-2 text-sm font-medium text-foreground/80">头像设置</p>
              <div className="flex flex-wrap items-center gap-2">
                {avatarColors.map((color) => (
                  <button key={color} type="button" onClick={() => handleColorSelect(color)}
                    className={cn('h-8 w-8 rounded-full transition-all', color,
                      avatarType === 'color' && avatarValue === color ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'hover:scale-105')} />
                ))}
                {savedImage && avatarType === 'color' && (
                  <button type="button" onClick={() => { setAvatarType('image'); setAvatarValue(savedImage); }}
                    className="ml-2 flex h-8 items-center gap-1 rounded-full border border-dashed border-border px-2 text-[11px] text-muted-foreground transition-colors hover:border-indigo-300 hover:text-indigo-500">
                    <Camera className="h-3 w-3" />恢复图片
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 姓名 + 邮箱 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/80">姓名</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/80">邮箱</label>
              <input type="email" value={user?.email || ''} disabled className="w-full rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm text-muted-foreground" />
            </div>
          </div>

          {/* 个人简介 */}
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-foreground/80">个人简介</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="用一句话介绍自己吧" rows={2}
              className="w-full resize-none rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground/80 outline-none placeholder:text-muted-foreground focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200" />
          </div>
        </div>
      </div>

      {/* ===== 趣味信息 ===== */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground/80">趣味信息</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Cake className="h-4 w-4 text-pink-500" />生日
              </label>
              <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Star className="h-4 w-4 text-amber-500" />星座
              </label>
              <select value={zodiac} onChange={(e) => setZodiac(e.target.value)} className={selectCls}>
                <option value="">选择星座</option>
                {zodiacOptions.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Brain className="h-4 w-4 text-purple-500" />MBTI
              </label>
              <select value={mbti} onChange={(e) => setMbti(e.target.value)} className={selectCls}>
                <option value="">选择类型</option>
                {mbtiOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Building2 className="h-4 w-4 text-blue-500" />公司/组织
              </label>
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="你在哪工作" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Sparkles className="h-4 w-4 text-indigo-500" />职位头衔
              </label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="你的职位" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Phone className="h-4 w-4 text-green-500" />手机号
              </label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="联系方式" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <MapPin className="h-4 w-4 text-red-500" />所在地
              </label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="城市" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground/80">
                <Globe className="h-4 w-4 text-cyan-500" />个人网站
              </label>
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className={inputCls} />
            </div>
          </div>
        </div>
      </div>

      {/* ===== 趣味标签 ===== */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground/80">我的标签</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">选择能代表你的标签，最多 8 个</p>
        </div>
        <div className="px-6 py-5">
          <div className="flex flex-wrap gap-2">
            {presetTags.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <button key={tag} type="button" onClick={() => {
                  if (!selected && tags.length >= 8) return;
                  toggleTag(tag);
                }}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm transition-all',
                    selected ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300' : 'bg-muted text-muted-foreground hover:bg-accent',
                    !selected && tags.length >= 8 && 'opacity-40 cursor-not-allowed',
                  )}>
                  {tag}
                </button>
              );
            })}
          </div>
          {tags.length > 0 && <p className="mt-3 text-[11px] text-muted-foreground">已选 {tags.length}/8</p>}
        </div>
      </div>

      {/* ===== 修改密码 ===== */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground/80">修改密码</h2>
        </div>
        <form onSubmit={handleChangePassword} className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground/80">原密码</label>
            <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="输入原密码" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/80">新密码</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少6位" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground/80">确认新密码</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入" className={inputCls} />
            </div>
          </div>
          {passwordMsg && (
            <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
              passwordMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
              {passwordMsg.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {passwordMsg.text}
            </div>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={savingPassword || !oldPassword || !newPassword}
              className="flex h-10 items-center gap-1.5 rounded-lg bg-red-600 px-5 text-sm font-medium text-white transition-all hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
              {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              修改密码
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
