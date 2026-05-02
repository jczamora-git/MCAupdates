import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Trash2, Grid3x3, Users, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertMessage } from "@/components/AlertMessage";
import { useConfirm } from "@/components/Confirm";
import { apiPost, apiGet, apiPut, apiDelete, API_ENDPOINTS } from "@/lib/api";

type Section = {
  id: string;
  name: string;
  students: string[];
  status: "active" | "inactive";
  description: string;
  yearLevel?: string;
  studentsCount?: number;
};

type YearLevel = {
  id: number;
  name: string;
};

type YearLevelWithSections = YearLevel & {
  sections: Section[];
};

// Preschool grade levels
const PRESCHOOL_LEVELS = [
  { name: "Nursery 1" },
  { name: "Nursery 2" },
  { name: "Kinder" },
  { name: "Grade 1" },
  { name: "Grade 2" },
  { name: "Grade 3" },
  { name: "Grade 4" },
  { name: "Grade 5" },
  { name: "Grade 6" },
];

const Sections = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Year levels with their sections
  const [yearLevelsWithSections, setYearLevelsWithSections] = useState<YearLevelWithSections[]>([]);

  // Dialog states
  const [isCreateYearOpen, setIsCreateYearOpen] = useState(false);
  const [isCreateSectionOpen, setIsCreateSectionOpen] = useState(false);
  const [selectedYearLevelId, setSelectedYearLevelId] = useState<number | null>(null);

  // Create Year Level form
  const [yearLevelForm, setYearLevelForm] = useState({
    name: "",
  });

  // Create Section form
  const [sectionForm, setSectionForm] = useState<Omit<Section, "id" | "students">>({
    name: "",
    status: "active",
    description: "Bachelor of Science in Information Technology",
    yearLevel: "",
  });

  // Edit forms
  const [isEditYearOpen, setIsEditYearOpen] = useState(false);
  const [editingYear, setEditingYear] = useState<YearLevel | null>(null);
  const [editYearForm, setEditYearForm] = useState({ name: "" });

  const [isEditSectionOpen, setIsEditSectionOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editSectionForm, setEditSectionForm] = useState<{ name: string; description: string; status: "active" | "inactive" }>({ name: "", description: "", status: "active" });

  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const [isInitializing, setIsInitializing] = useState(false);

  const showAlert = (type: "success" | "error" | "info", message: string) => {
    setAlert({ type, message });
  };

  const getDefaultDescription = (yearLevelId?: number) => {
    if (!yearLevelId) return "Section for students of Maranatha Christian Academy";
    const yearLevel = yearLevelsWithSections.find(y => y.id === yearLevelId);
    return yearLevel 
      ? `Section for ${yearLevel.name} students of Maranatha Christian Academy`
      : "Section for students of Maranatha Christian Academy";
  };

  const confirm = useConfirm();

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      navigate("/auth");
    } else {
      fetchData();
    }
  }, [isAuthenticated, user, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch year levels from backend
      const yearLevelsRes = await apiGet('/api/year-levels');
      
      if (yearLevelsRes.success && yearLevelsRes.year_levels) {
        const yearsWithSections: YearLevelWithSections[] = await Promise.all(
          yearLevelsRes.year_levels.map(async (yl: YearLevel) => {
            try {
              // Fetch sections for this year level
              const sectionsRes = await apiGet(`/api/year-levels/${yl.id}/sections`);
              let sectionList: Section[] = [];
              
              if (Array.isArray(sectionsRes)) {
                sectionList = sectionsRes.map((s: any) => ({
                  id: s.id.toString(),
                  name: s.name,
                  students: [],
                  status: s.status || "active",
                  description: s.description || "",
                  yearLevel: yl.name,
                  studentsCount: 0,
                }));
              } else if (sectionsRes.success && sectionsRes.sections) {
                sectionList = sectionsRes.sections.map((s: any) => ({
                  id: s.id.toString(),
                  name: s.name,
                  students: [],
                  status: s.status || "active",
                  description: s.description || "",
                  yearLevel: yl.name,
                  studentsCount: 0,
                }));
              }

              // Fetch student counts for each section
              await Promise.all(
                sectionList.map(async (sec) => {
                  try {
                    const res = await apiGet(`/api/students?section_id=${encodeURIComponent(sec.id)}&year_level=${encodeURIComponent(yl.name)}`);
                    let count = 0;
                    if (Array.isArray(res)) count = res.length;
                    else if (res?.data && Array.isArray(res.data)) count = res.data.length;
                    else if (res?.students && Array.isArray(res.students)) count = res.students.length;
                    sec.studentsCount = count;
                  } catch (e) {
                    sec.studentsCount = 0;
                  }
                })
              );

              return {
                ...yl,
                sections: sectionList,
              };
            } catch (error) {
              console.error(`Failed to fetch sections for year level ${yl.id}:`, error);
              return {
                ...yl,
                sections: [],
              };
            }
          })
        );

        setYearLevelsWithSections(yearsWithSections);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showAlert('error', 'Failed to load data from server');
    } finally {
      setLoading(false);
    }
  };

  // Initialize preschool levels
  const initializePreschoolLevels = async () => {
    setIsInitializing(true);
    try {
      const createdLevels = [];
      
      for (const level of PRESCHOOL_LEVELS) {
        try {
          const data = await apiPost('/api/year-levels', {
            name: level.name,
          });

          const ok = data && (typeof data.success === 'undefined' ? true : data.success);
          if (ok) {
            createdLevels.push(level.name);
          }
        } catch (error) {
          console.error(`Failed to create ${level.name}:`, error);
        }
      }

      if (createdLevels.length > 0) {
        await fetchData();
        showAlert(
          "success",
          `Preschool setup complete! Created ${createdLevels.length} grade level${createdLevels.length !== 1 ? 's' : ''}: ${createdLevels.join(", ")}`
        );
      } else {
        showAlert("info", "Grade levels already exist or setup was skipped");
      }
    } catch (error) {
      console.error('Error initializing preschool levels:', error);
      showAlert('error', 'Failed to initialize preschool levels');
    } finally {
      setIsInitializing(false);
    }
  };


  // Listen for updates from detail pages
  useEffect(() => {
    const handler = (e: Event) => {
      const updated = (e as CustomEvent).detail as Section;
      setYearLevelsWithSections((prev) =>
        prev.map((yl) => ({
          ...yl,
          sections: yl.sections.map((s) => (s.id === updated.id ? updated : s)),
        }))
      );
    };
    window.addEventListener("section-updated", handler as EventListener);
    return () => window.removeEventListener("section-updated", handler as EventListener);
  }, []);

  const filteredYearLevels = yearLevelsWithSections.filter((yl) => {
    const q = searchQuery.trim().toLowerCase();
    const matchingSections = yl.sections.filter((section) => {
      const sectionMatchesSearch =
        q === "" ||
        section.name.toLowerCase().includes(q) ||
        (section.description || "").toLowerCase().includes(q);

      const sectionMatchesStatus =
        statusFilter === "all" || section.status === statusFilter;

      return sectionMatchesSearch && sectionMatchesStatus;
    });

    const yearMatchesSearch = q === "" || yl.name.toLowerCase().includes(q);

    if (!yearMatchesSearch && matchingSections.length === 0) {
      return false;
    }

    if (statusFilter !== "all" && matchingSections.length === 0) {
      return false;
    }

    return true;
  });

  // YEAR LEVEL HANDLERS
  const handleCreateYear = async () => {
    if (!yearLevelForm.name.trim()) {
      showAlert("error", "Year level name is required");
      return;
    }

    try {
      const data = await apiPost('/api/year-levels', {
        name: yearLevelForm.name.trim(),
      });

      const ok = data && (typeof data.success === 'undefined' ? true : data.success);

      if (ok) {
        await fetchData();
        setIsCreateYearOpen(false);
        setYearLevelForm({ name: "" });
        showAlert("success", `Year level ${yearLevelForm.name} created`);
      } else {
        showAlert("error", data.message || "Failed to create year level");
      }
    } catch (error: any) {
      console.error('Error creating year level:', error);
      showAlert("error", error.message || "Failed to create year level");
    }
  };

  const handleEditYear = (year: YearLevel) => {
    setEditingYear(year);
    setEditYearForm({ name: year.name });
    setIsEditYearOpen(true);
  };

  const handleSaveEditYear = async () => {
    if (!editingYear) return;
    if (!editYearForm.name.trim()) {
      showAlert("error", "Year level name is required");
      return;
    }

    try {
      const data = await apiPut(`/api/year-levels/${editingYear.id}`, {
        name: editYearForm.name.trim(),
      });

      const ok = data && (typeof data.success === 'undefined' ? true : data.success);

      if (ok) {
        await fetchData();
        setIsEditYearOpen(false);
        showAlert("success", "Year level updated successfully");
      } else {
        showAlert("error", data.message || "Failed to update year level");
      }
    } catch (error: any) {
      console.error('Error updating year level:', error);
      showAlert("error", error.message || "Failed to update year level");
    }
  };

  const handleDeleteYear = async (id: number) => {
    const year = yearLevelsWithSections.find((y) => y.id === id);
    if (!year) return;

    const ok = await confirm({
      title: 'Delete year level',
      description: `Delete year level ${year.name}? This will remove all associated sections.`,
      emphasis: year.name,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!ok) return;

    try {
      const data = await apiDelete(`/api/year-levels/${id}`);

      const ok = data && (typeof data.success === 'undefined' ? true : data.success);

      if (ok) {
        await fetchData();
        showAlert("success", `Year level ${year.name} deleted`);
      } else {
        showAlert("error", data.message || "Failed to delete year level");
      }
    } catch (error: any) {
      console.error('Error deleting year level:', error);
      showAlert("error", error.message || "Failed to delete year level");
    }
  };

  // SECTION HANDLERS
  const handleOpenCreateSection = (yearLevelId: number) => {
    setSelectedYearLevelId(yearLevelId);
    setSectionForm({
      name: "",
      status: "active",
      description: getDefaultDescription(yearLevelId),
      yearLevel: "",
    });
    setIsCreateSectionOpen(true);
  };

  const handleCreateSection = async () => {
    if (!sectionForm.name.trim()) {
      showAlert("error", "Section name is required");
      return;
    }

    if (!selectedYearLevelId) {
      showAlert("error", "Year level not selected");
      return;
    }

    try {
      const data = await apiPost(`/api/year-levels/${selectedYearLevelId}/sections`, {
        name: sectionForm.name.trim(),
        description: sectionForm.description,
        status: sectionForm.status,
      });

      const ok = data && (typeof data.success === 'undefined' ? true : data.success);

      if (ok) {
        await fetchData();
        setIsCreateSectionOpen(false);
        setSectionForm({
          name: "",
          status: "active",
          description: getDefaultDescription(selectedYearLevelId || undefined),
          yearLevel: "",
        });
        setSelectedYearLevelId(null);
        showAlert("success", `Section ${sectionForm.name} created`);
      } else {
        showAlert("error", data.message || "Failed to create section");
      }
    } catch (error: any) {
      console.error('Error creating section:', error);
      showAlert("error", error.message || "Failed to create section");
    }
  };

  const handleEditSection = (section: Section) => {
    setEditingSection(section);
    setEditSectionForm({
      name: section.name,
      description: section.description,
      status: section.status,
    });
    setIsEditSectionOpen(true);
  };

  const handleSaveEditSection = async () => {
    if (!editingSection) return;
    if (!editSectionForm.name.trim()) {
      showAlert("error", "Section name is required");
      return;
    }

    try {
      const data = await apiPut(`/api/sections/${editingSection.id}`, {
        name: editSectionForm.name.trim(),
        description: editSectionForm.description,
        status: editSectionForm.status,
      });

      const ok = data && (typeof data.success === 'undefined' ? true : data.success);

      if (ok) {
        await fetchData();
        setIsEditSectionOpen(false);
        showAlert("success", "Section updated successfully");
      } else {
        showAlert("error", data.message || "Failed to update section");
      }
    } catch (error: any) {
      console.error('Error updating section:', error);
      showAlert("error", error.message || "Failed to update section");
    }
  };

  const handleDeactivateSection = async (id: string) => {
    const section = yearLevelsWithSections
      .flatMap((yl) => yl.sections)
      .find((s) => s.id === id);

    if (!section) return;

    const ok = await confirm({
      title: 'Deactivate section',
      description: `Deactivate section ${section.name}?`,
      emphasis: section.name,
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!ok) return;

    try {
      const data = await apiPut(`/api/sections/${id}`, { status: 'inactive' });

      const ok = data && (typeof data.success === 'undefined' ? true : data.success);

      if (ok) {
        await fetchData();
        showAlert("success", `Section ${section.name} deactivated`);
      } else {
        showAlert("error", data.message || "Failed to deactivate section");
      }
    } catch (error: any) {
      console.error('Error deactivating section:', error);
      showAlert("error", error.message || "Failed to deactivate section");
    }
  };

  const handleDeleteSection = async (id: string) => {
    const section = yearLevelsWithSections
      .flatMap((yl) => yl.sections)
      .find((s) => s.id === id);

    if (!section) return;

    const ok = await confirm({
      title: 'Delete section permanently',
      description: `Delete section ${section.name}? This action cannot be undone.`,
      emphasis: section.name,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (!ok) return;

    try {
      const data = await apiDelete(`/api/sections/${id}`);

      const ok = data && (typeof data.success === 'undefined' ? true : data.success);

      if (ok) {
        await fetchData();
        showAlert("success", `Section ${section.name} deleted`);
      } else {
        showAlert("error", data.message || "Failed to delete section");
      }
    } catch (error: any) {
      console.error('Error deleting section:', error);
      showAlert("error", error.message || "Failed to delete section");
    }
  };

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading grade levels and sections...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Preschool Grades & Sections
            </h1>
            <p className="text-muted-foreground text-lg">Manage preschool grade levels (Nursery 1-2, Kinder, Grades 1-6) and their sections</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => setIsCreateYearOpen(true)} 
              className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Grade Level
            </Button>
          </div>
        </div>

        <Card className="shadow-lg border-0">
          <CardHeader className="border-b pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold">Grade Levels ({filteredYearLevels.length})</CardTitle>
                <CardDescription className="text-base">Create and manage preschool grades with sections</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-4 items-center mb-6">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search grade level or section..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>

            {filteredYearLevels.length === 0 ? (
              <div className="text-center py-12">
                <Grid3x3 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">No year levels found</p>
                <div className="mt-6 flex flex-col gap-3 items-center">
                  <p className="text-sm text-muted-foreground">Quick setup for preschool grades:</p>
                  <Button 
                    onClick={initializePreschoolLevels}
                    disabled={isInitializing}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold px-6 py-2"
                  >
                    {isInitializing ? "Setting up..." : "Setup Preschool Grades"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    or create manually:
                  </p>
                  <Button 
                    onClick={() => setIsCreateYearOpen(true)}
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Year Level
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                  <thead className="bg-muted/40 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grade Level</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sections</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredYearLevels.map((yearLevel) => {
                      const filteredSections = yearLevel.sections.filter((section) => {
                        const q = searchQuery.trim().toLowerCase();
                        const sectionMatchesSearch =
                          q === "" ||
                          yearLevel.name.toLowerCase().includes(q) ||
                          section.name.toLowerCase().includes(q) ||
                          (section.description || "").toLowerCase().includes(q);

                        const sectionMatchesStatus =
                          statusFilter === "all" || section.status === statusFilter;

                        return sectionMatchesSearch && sectionMatchesStatus;
                      });

                      return (
                        <tr key={yearLevel.id} className="hover:bg-muted/20">
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-2">
                              <p className="font-semibold text-sm">{yearLevel.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {filteredSections.length} section{filteredSections.length !== 1 ? "s" : ""}
                                {filteredSections.length > 0 &&
                                  ` • ${filteredSections.reduce((sum, s) => sum + (s.studentsCount ?? 0), 0)} students`}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="group rounded-lg border border-gray-200 p-2.5 bg-gray-50/40">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-gray-700">Section List</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleOpenCreateSection(yearLevel.id)}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add Section
                                </Button>
                              </div>

                              {filteredSections.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No sections found</p>
                              ) : (
                                <div className="space-y-2">
                                  {filteredSections.map((section) => (
                                    <div key={section.id} className="rounded-md border bg-white p-2.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-xs font-medium text-gray-900 truncate">{section.name}</p>
                                            <Badge variant={section.status === "active" ? "default" : "secondary"}>
                                              {section.status}
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                              {section.studentsCount ?? 0} student{(section.studentsCount ?? 0) !== 1 ? "s" : ""}
                                            </Badge>
                                          </div>
                                          <p className="text-xs text-muted-foreground mt-1 truncate">{section.description || "-"}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-[10px]"
                                            onClick={() =>
                                              navigate(`/admin/users/sections/${section.id}`, {
                                                state: {
                                                  section,
                                                  yearLevel: yearLevel.name,
                                                },
                                              })
                                            }
                                          >
                                            <Users className="w-3 h-3 mr-1" />
                                            Students
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-[10px]"
                                            onClick={() => handleEditSection(section)}
                                          >
                                            <Edit className="w-3 h-3 mr-1" />
                                            Edit
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDeactivateSection(section.id)}
                                            disabled={section.status === "inactive"}
                                            className="h-7 w-7 hover:bg-red-100"
                                            title="Deactivate"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-right">
                            <div className="inline-flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditYear(yearLevel)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteYear(yearLevel.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Year Level Dialog */}
        <Dialog open={isCreateYearOpen} onOpenChange={setIsCreateYearOpen}>
          <DialogContent className="max-w-2xl border-0 shadow-2xl">
            <DialogHeader className="bg-gradient-to-r from-primary to-accent px-6 py-6 -mx-6 -mt-6 mb-6 rounded-t-lg">
              <DialogTitle className="text-2xl font-bold text-white">Create New Grade Level</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 px-2">
              <div>
                <Label htmlFor="year-name" className="font-semibold text-lg">Grade Level Name *</Label>
                <Input
                  id="year-name"
                  value={yearLevelForm.name}
                  onChange={(e) => setYearLevelForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Nursery 1, Nursery 2, Kinder, Grade 1"
                  className="mt-2 py-3 text-base border-2 focus:border-purple-500 rounded-lg"
                />
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-900 font-medium">
                  ✓ Create grade levels first, then add sections to each one.
                </p>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateYearOpen(false)}
                  className="px-4 py-2"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateYear}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold px-4 py-2"
                >
                  Create Grade Level
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Year Level Dialog */}
        <Dialog open={isEditYearOpen} onOpenChange={setIsEditYearOpen}>
          <DialogContent className="max-w-2xl border-0 shadow-2xl">
            <DialogHeader className="bg-gradient-to-r from-primary to-accent px-6 py-6 -mx-6 -mt-6 mb-6 rounded-t-lg">
              <DialogTitle className="text-2xl font-bold text-white">Edit Grade Level</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 px-2">
              <div>
                <Label htmlFor="edit-year-name" className="font-semibold text-lg">Grade Level Name *</Label>
                <Input
                  id="edit-year-name"
                  value={editYearForm.name}
                  onChange={(e) => setEditYearForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Nursery 1, Grade 3"
                  className="mt-2 py-3 text-base border-2 focus:border-purple-500 rounded-lg"
                />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <Button
                  variant="outline"
                  onClick={() => setIsEditYearOpen(false)}
                  className="px-4 py-2"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEditYear}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold px-4 py-2"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Section Dialog */}
        <Dialog open={isCreateSectionOpen} onOpenChange={setIsCreateSectionOpen}>
          <DialogContent className="max-w-2xl border-0 shadow-2xl">
            <DialogHeader className="bg-gradient-to-r from-primary to-accent px-6 py-6 -mx-6 -mt-6 mb-6 rounded-t-lg">
              <DialogTitle className="text-2xl font-bold text-white">
                Create New Section
                {selectedYearLevelId && yearLevelsWithSections.find(y => y.id === selectedYearLevelId) && 
                  ` - ${yearLevelsWithSections.find(y => y.id === selectedYearLevelId)?.name}`
                }
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 px-2">
              <div>
                <Label htmlFor="section-name" className="font-semibold text-lg">Section Name *</Label>
                <Input
                  id="section-name"
                  value={sectionForm.name}
                  onChange={(e) => setSectionForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., F1, F2, Section A"
                  className="mt-2 py-3 text-base border-2 focus:border-purple-500 rounded-lg"
                />
              </div>

              <div>
                <Label htmlFor="section-description" className="font-semibold text-lg">Description</Label>
                <Input
                  id="section-description"
                  value={sectionForm.description}
                  onChange={(e) => setSectionForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g., Bachelor of Science in Information Technology"
                  className="mt-2 py-3 text-base border-2 focus:border-purple-500 rounded-lg"
                />
              </div>

              <div>
                <Label htmlFor="section-status" className="font-semibold text-lg">Status</Label>
                <div className="w-40 mt-2">
                  <Select value={sectionForm.status} onValueChange={(v) => setSectionForm((f) => ({ ...f, status: v as "active" | "inactive" }))}>
                    <SelectTrigger className="border-2 focus:border-accent-500 rounded-lg px-3 py-2 bg-background">
                      <SelectValue>{sectionForm.status === "active" ? "Active" : "Inactive"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-900 font-medium">
                  ✓ Sections are created as Active by default and can be deactivated later.
                </p>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateSectionOpen(false)}
                  className="px-4 py-2"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSection}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold px-4 py-2"
                >
                  Create Section
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Section Dialog */}
        <Dialog open={isEditSectionOpen} onOpenChange={setIsEditSectionOpen}>
          <DialogContent className="max-w-2xl border-0 shadow-2xl">
            <DialogHeader className="bg-gradient-to-r from-primary to-accent px-6 py-6 -mx-6 -mt-6 mb-6 rounded-t-lg">
              <DialogTitle className="text-2xl font-bold text-white">Edit Section</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 px-2">
              <div>
                <Label htmlFor="edit-section-name" className="font-semibold text-lg">Section Name *</Label>
                <Input
                  id="edit-section-name"
                  value={editSectionForm.name}
                  onChange={(e) => setEditSectionForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., F1"
                  className="mt-2 py-3 text-base border-2 focus:border-purple-500 rounded-lg"
                />
              </div>

              <div>
                <Label htmlFor="edit-section-description" className="font-semibold text-lg">Description</Label>
                <Input
                  id="edit-section-description"
                  value={editSectionForm.description}
                  onChange={(e) => setEditSectionForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g., Bachelor of Science in Information Technology"
                  className="mt-2 py-3 text-base border-2 focus:border-purple-500 rounded-lg"
                />
              </div>

              <div>
                <Label htmlFor="edit-section-status" className="font-semibold text-lg">Status</Label>
                <div className="w-40 mt-2">
                  <Select value={editSectionForm.status} onValueChange={(v) => setEditSectionForm((f) => ({ ...f, status: v as "active" | "inactive" }))}>
                    <SelectTrigger className="border-2 focus:border-accent-500 rounded-lg px-3 py-2 bg-background">
                      <SelectValue>{editSectionForm.status === "active" ? "Active" : "Inactive"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <Button
                  variant="outline"
                  onClick={() => setIsEditSectionOpen(false)}
                  className="px-4 py-2"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEditSection}
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-semibold px-4 py-2"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {alert && <AlertMessage type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      </div>
    </DashboardLayout>
  );
};

export default Sections;
