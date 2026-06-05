'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import Header from '../../components/Header';
import VerificationBadge from '../../components/VerificationBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import toast from 'react-hot-toast';
import { User as UserIcon, Mail, Lock, Shield, Wallet, Save, Edit2, X } from 'lucide-react';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize fields
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  // Validation rules helper
  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Password must contain at least one special character';
    return null;
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const updates: Record<string, string> = {};

    if (name.trim() !== user.name) {
      if (name.trim().length < 2) {
        toast.error('Name must be at least 2 characters');
        return;
      }
      updates.name = name.trim();
    }

    if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast.error('Please enter a valid email address');
        return;
      }
      updates.email = email.trim().toLowerCase();
    }

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        toast.error('Current password is required to set a new password');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('New passwords do not match');
        return;
      }
      const pwdError = validatePassword(newPassword);
      if (pwdError) {
        toast.error(pwdError);
        return;
      }
      updates.password = newPassword;
    }

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    const savePromise = authService.updateProfile(updates);

    toast.promise(savePromise, {
      loading: 'Saving profile updates...',
      success: (data) => {
        updateUser(data.user);
        setIsEditing(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        return 'Profile updated successfully!';
      },
      error: (err) => {
        const msg = err.response?.data?.message || 'Failed to update profile';
        return msg;
      }
    }).finally(() => {
      setIsSaving(false);
    });
  };

  const handleCancel = () => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setIsEditing(false);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300/30';
      case 'farmer':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-300/30';
      case 'mandi':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300/30';
      case 'transporter':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/30';
      case 'retailer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300/30';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-700/30';
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        
        <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
              <p className="text-sm text-muted-foreground">
                Manage your CropChain account details and password settings.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Account Status Card (Left column) */}
              <div className="space-y-6 md:col-span-1">
                <Card className="border border-border/40 bg-card/65 backdrop-blur-md shadow-sm">
                  <CardHeader className="pb-3 text-center">
                    <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 text-primary mb-3">
                      <UserIcon className="h-10 w-10" />
                    </div>
                    <CardTitle className="text-lg font-bold leading-tight truncate">{user?.name}</CardTitle>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-semibold flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5" /> Role
                      </span>
                      <Badge variant="outline" className={`capitalize font-bold border ${getRoleBadgeColor(user?.role || '')}`}>
                        {user?.role}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-semibold flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5" /> Verification
                      </span>
                      <VerificationBadge isVerified={user?.verification?.isVerified || false} size="sm" />
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-border/40">
                      <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Wallet className="h-3.5 w-3.5" /> Registered Wallet
                      </span>
                      {user?.walletAddress ? (
                        <p className="text-xs font-mono bg-muted/65 p-2 rounded-lg break-all select-all font-semibold border border-border/30">
                          {user.walletAddress}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground font-medium italic">
                          No wallet linked
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Profile Editor Card (Right column) */}
              <div className="md:col-span-2">
                <form onSubmit={handleSave}>
                  <Card className="border border-border/40 bg-card/65 backdrop-blur-md shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-border/40 pb-4">
                      <div>
                        <CardTitle className="text-lg font-bold">Personal Information</CardTitle>
                      </div>
                      {!isEditing ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                          className="h-8 rounded-lg gap-1.5 font-bold"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Edit Profile
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="h-8 rounded-lg text-muted-foreground hover:bg-muted font-bold"
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={isSaving}
                            className="h-8 rounded-lg gap-1.5 font-bold"
                          >
                            <Save className="h-3.5 w-3.5" /> Save Changes
                          </Button>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      <div className="grid grid-cols-1 gap-6">
                        {/* Name Input */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-primary" /> Full Name
                          </label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={!isEditing || isSaving}
                            placeholder="Enter your name"
                            className="w-full px-4 py-2 border border-border bg-background/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                          />
                        </div>

                        {/* Email Input */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-primary" /> Email Address
                          </label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={!isEditing || isSaving}
                            placeholder="Enter your email"
                            className="w-full px-4 py-2 border border-border bg-background/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                          />
                        </div>
                      </div>

                      {/* Password Settings Section */}
                      {isEditing && (
                        <div className="pt-6 border-t border-border/40 space-y-4">
                          <h3 className="text-sm font-bold text-foreground">Change Password</h3>
                          
                          <div className="grid grid-cols-1 gap-4">
                            {/* Current Password */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Current Password
                              </label>
                              <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                disabled={isSaving}
                                placeholder="••••••••"
                                className="w-full px-4 py-2 border border-border bg-background/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                              />
                            </div>

                            {/* New Password */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Lock className="h-3.5 w-3.5 text-muted-foreground" /> New Password
                              </label>
                              <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={isSaving}
                                placeholder="••••••••"
                                className="w-full px-4 py-2 border border-border bg-background/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                              />
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Lock className="h-3.5 w-3.5 text-muted-foreground" /> Confirm New Password
                              </label>
                              <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={isSaving}
                                placeholder="••••••••"
                                className="w-full px-4 py-2 border border-border bg-background/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
