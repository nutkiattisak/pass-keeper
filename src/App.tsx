import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/tauri"
import {
  KeyIcon,
  Plus,
  Search,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Edit,
  Trash2,
  RefreshCw,
  LogOut,
} from "lucide-react"
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog"
import { Textarea } from "./components/ui/textarea"
import { Badge } from "./components/ui/badge"

interface PasswordEntry {
  id: number
  title: string
  username: string
  password: string
  url?: string
  notes?: string
  created_at: string
  updated_at: string
}

function App() {
  const [isSetup, setIsSetup] = useState<boolean | null>(null)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [masterPassword, setMasterPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwords, setPasswords] = useState<PasswordEntry[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isGeneratorDialogOpen, setIsGeneratorDialogOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState<PasswordEntry | null>(null)
  const [showPassword, setShowPassword] = useState<{ [key: number]: boolean }>({})
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [formData, setFormData] = useState({
    title: "",
    username: "",
    password: "",
    url: "",
    notes: "",
  })

  const [generatorSettings, setGeneratorSettings] = useState({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  })

  useEffect(() => {
    checkSetup()
  }, [])

  useEffect(() => {
    if (isUnlocked) {
      loadPasswords()
    }
  }, [isUnlocked])

  async function checkSetup() {
    try {
      const exists = await invoke<boolean>("check_master_password_exists")
      setIsSetup(exists)
    } catch (err) {
      setError("Failed to check setup status")
    }
  }

  async function handleSetupMasterPassword() {
    if (masterPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (masterPassword.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    try {
      await invoke("setup_master_password", { password: masterPassword })
      setSuccess("Master password created successfully")
      setMasterPassword("")
      setConfirmPassword("")
      setIsSetup(true)
    } catch (err) {
      setError("Failed to setup master password")
    }
  }

  async function handleLogin() {
    try {
      const valid = await invoke<boolean>("verify_master_password", {
        password: masterPassword,
      })
      if (valid) {
        setIsUnlocked(true)
        setMasterPassword("")
        setError("")
      } else {
        setError("Invalid master password")
      }
    } catch (err) {
      setError("Failed to verify password")
    }
  }

  async function handleLock() {
    try {
      await invoke("lock_app")
      setIsUnlocked(false)
      setPasswords([])
      setSearchQuery("")
    } catch (err) {
      setError("Failed to lock app")
    }
  }

  async function loadPasswords() {
    try {
      const allPasswords = await invoke<PasswordEntry[]>("get_all_passwords")
      setPasswords(allPasswords)
    } catch (err) {
      setError("Failed to load passwords")
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query)
    if (!query) {
      loadPasswords()
      return
    }

    try {
      const results = await invoke<PasswordEntry[]>("search_passwords", { query })
      setPasswords(results)
    } catch (err) {
      setError("Failed to search passwords")
    }
  }

  async function handleAddPassword() {
    if (!formData.title || !formData.username || !formData.password) {
      setError("Title, username, and password are required")
      return
    }

    try {
      await invoke("add_password", {
        title: formData.title,
        username: formData.username,
        password: formData.password,
        url: formData.url || null,
        notes: formData.notes || null,
      })
      setSuccess("Password added successfully")
      setIsAddDialogOpen(false)
      resetForm()
      loadPasswords()
    } catch (err) {
      setError("Failed to add password")
    }
  }

  async function handleUpdatePassword() {
    if (!currentPassword) return
    if (!formData.title || !formData.username || !formData.password) {
      setError("Title, username, and password are required")
      return
    }

    try {
      await invoke("update_password", {
        id: currentPassword.id,
        title: formData.title,
        username: formData.username,
        password: formData.password,
        url: formData.url || null,
        notes: formData.notes || null,
      })
      setSuccess("Password updated successfully")
      setIsEditDialogOpen(false)
      resetForm()
      setCurrentPassword(null)
      loadPasswords()
    } catch (err) {
      setError("Failed to update password")
    }
  }

  async function handleDeletePassword(id: number) {
    if (!confirm("Are you sure you want to delete this password?")) return

    try {
      await invoke("delete_password", { id })
      setSuccess("Password deleted successfully")
      loadPasswords()
    } catch (err) {
      setError("Failed to delete password")
    }
  }

  async function handleGeneratePassword() {
    try {
      const generated = await invoke<string>("generate_password", {
        length: generatorSettings.length,
        useUppercase: generatorSettings.uppercase,
        useLowercase: generatorSettings.lowercase,
        useNumbers: generatorSettings.numbers,
        useSymbols: generatorSettings.symbols,
      })
      setFormData({ ...formData, password: generated })
      setSuccess("Password generated!")
      setIsGeneratorDialogOpen(false)
    } catch (err) {
      setError("Failed to generate password")
    }
  }

  function handleCopyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setSuccess(`${field} copied to clipboard`)
    setTimeout(() => setSuccess(""), 2000)
  }

  function handleEditPassword(password: PasswordEntry) {
    setCurrentPassword(password)
    setFormData({
      title: password.title,
      username: password.username,
      password: password.password,
      url: password.url || "",
      notes: password.notes || "",
    })
    setIsEditDialogOpen(true)
  }

  function resetForm() {
    setFormData({
      title: "",
      username: "",
      password: "",
      url: "",
      notes: "",
    })
  }

  function togglePasswordVisibility(id: number) {
    setShowPassword((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  if (isSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!isSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="h-6 w-6" />
              Setup Master Password
            </CardTitle>
            <CardDescription>
              Create a master password to secure your password vault
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="master-password">Master Password</Label>
                <Input
                  id="master-password"
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Enter master password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm master password"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}
              <Button className="w-full" onClick={handleSetupMasterPassword}>
                Create Master Password
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-6 w-6" />
              Unlock Pass Keeper
            </CardTitle>
            <CardDescription>Enter your master password to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Master Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Enter master password"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button className="w-full" onClick={handleLogin}>
                Unlock
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <KeyIcon className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Pass Keeper</h1>
          </div>
          <Button variant="outline" onClick={handleLock}>
            <LogOut className="mr-2 h-4 w-4" />
            Lock
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            {success}
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="Search passwords..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Password
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {passwords.map((password) => (
            <Card key={password.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{password.title}</CardTitle>
                    {password.url && (
                      <CardDescription className="mt-1 truncate">
                        {password.url}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditPassword(password)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePassword(password.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-xs text-gray-500">Username</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => handleCopyToClipboard(password.username, "Username")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm font-mono">{password.username}</p>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-xs text-gray-500">Password</Label>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => togglePasswordVisibility(password.id)}
                      >
                        {showPassword[password.id] ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => handleCopyToClipboard(password.password, "Password")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm font-mono">
                    {showPassword[password.id]
                      ? password.password
                      : "•".repeat(password.password.length)}
                  </p>
                </div>
                {password.notes && (
                  <div>
                    <Label className="text-xs text-gray-500">Notes</Label>
                    <p className="text-sm text-gray-600 mt-1">{password.notes}</p>
                  </div>
                )}
                <div className="text-xs text-gray-400 pt-2 border-t">
                  Updated: {new Date(password.updated_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {passwords.length === 0 && (
          <div className="text-center py-12">
            <KeyIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No passwords yet</h3>
            <p className="text-gray-500">Click "Add Password" to create your first entry</p>
          </div>
        )}

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Password</DialogTitle>
              <DialogDescription>
                Fill in the details to save a new password
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Gmail, Facebook"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="email or username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="password"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsGeneratorDialogOpen(true)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddPassword}>Add Password</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Password</DialogTitle>
              <DialogDescription>Update your password details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username *</Label>
                <Input
                  id="edit-username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Password *</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-password"
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsGeneratorDialogOpen(true)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-url">URL</Label>
                <Input
                  id="edit-url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePassword}>Update Password</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isGeneratorDialogOpen} onOpenChange={setIsGeneratorDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Password</DialogTitle>
              <DialogDescription>Customize your password settings</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="length">Length: {generatorSettings.length}</Label>
                <input
                  id="length"
                  type="range"
                  min="8"
                  max="64"
                  value={generatorSettings.length}
                  onChange={(e) =>
                    setGeneratorSettings({
                      ...generatorSettings,
                      length: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={generatorSettings.uppercase}
                    onChange={(e) =>
                      setGeneratorSettings({
                        ...generatorSettings,
                        uppercase: e.target.checked,
                      })
                    }
                  />
                  <span>Uppercase (A-Z)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={generatorSettings.lowercase}
                    onChange={(e) =>
                      setGeneratorSettings({
                        ...generatorSettings,
                        lowercase: e.target.checked,
                      })
                    }
                  />
                  <span>Lowercase (a-z)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={generatorSettings.numbers}
                    onChange={(e) =>
                      setGeneratorSettings({
                        ...generatorSettings,
                        numbers: e.target.checked,
                      })
                    }
                  />
                  <span>Numbers (0-9)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={generatorSettings.symbols}
                    onChange={(e) =>
                      setGeneratorSettings({
                        ...generatorSettings,
                        symbols: e.target.checked,
                      })
                    }
                  />
                  <span>Symbols (!@#$...)</span>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsGeneratorDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGeneratePassword}>Generate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default App
