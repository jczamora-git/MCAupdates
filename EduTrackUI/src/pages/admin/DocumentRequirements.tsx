import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { API_ENDPOINTS } from '@/lib/api';
import { FileText, Plus, Search, RotateCcw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DocumentRequirement {
  id: number;
  grade_level: string;
  enrollment_type: 'New Student' | 'Returning Student' | 'Transferee' | null;
  document_name: string;
  is_required: boolean;
  display_order: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CatalogDocument {
  id: number;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface RequirementDeleteTarget {
  ids: number[];
  documentName: string;
  gradeLevel: string;
  enrollmentTypeLabel: string;
}

const GRADE_LEVELS = [
  'Nursery 1',
  'Nursery 2',
  'Kinder',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6'
];

const ENROLLMENT_TYPES = ['New Student', 'Returning Student', 'Transferee'];

interface DocumentRequirementsProps {
  embedded?: boolean;
}

export default function DocumentRequirements({ embedded = false }: DocumentRequirementsProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [yearLevels, setYearLevels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [isDocumentCreateOnly, setIsDocumentCreateOnly] = useState(false);
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogDocuments, setCatalogDocuments] = useState<CatalogDocument[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [showManageDocuments, setShowManageDocuments] = useState(false);
  const [catalogEditOpen, setCatalogEditOpen] = useState(false);
  const [catalogEditingDoc, setCatalogEditingDoc] = useState<CatalogDocument | null>(null);
  const [catalogEditForm, setCatalogEditForm] = useState({
    name: '',
    description: ''
  });
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignContext, setAssignContext] = useState<{ grade_level: string } | null>(null);
  const [assignMode, setAssignMode] = useState<'required' | 'additional'>('required');
  const [assignEnrollmentType, setAssignEnrollmentType] = useState<'New Student' | 'Returning Student' | 'Transferee'>('New Student');
  const [assignForm, setAssignForm] = useState({
    document_ids: [] as string[]
  });
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [bulkForm, setBulkForm] = useState({
    grade_levels: [] as string[],
    enrollment_type: 'all' as 'all' | 'New Student' | 'Returning Student' | 'Transferee',
    document_ids: [] as string[]
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RequirementDeleteTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    grade_levels: [] as string[],
    enrollment_types: [] as string[], // Changed to array for multiple selection
    document_name: '',
    is_required: true,
    display_order: 0,
    description: '',
    is_active: true
  });

  useEffect(() => {
    fetchRequirements();
    fetchYearLevels();
  }, []);

  const fetchYearLevels = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.YEAR_LEVELS, {
        credentials: 'include'
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const rows = payload?.year_levels || payload?.data || (Array.isArray(payload) ? payload : []);

      if (!Array.isArray(rows)) {
        return;
      }

      const names = rows
        .map((row: any) => String(row?.name ?? row?.level_name ?? row?.year_level ?? row?.label ?? '').trim())
        .filter((name: string) => name.length > 0);

      if (names.length > 0) {
        setYearLevels(Array.from(new Set(names)));
      }
    } catch (error) {
      console.error('Error fetching year levels:', error);
    }
  };

  const fetchRequirements = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch requirements');

      const data = await response.json();
      if (data.success) {
        setRequirements(data.data);
      }
    } catch (error) {
      console.error('Error fetching requirements:', error);
      toast({
        title: 'Error',
        description: 'Failed to load document requirements',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogDocuments = async () => {
    try {
      setCatalogLoading(true);
      const response = await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_CATALOG, {
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch required documents');

      const data = await response.json();
      if (data.success) {
        setCatalogDocuments(Array.isArray(data.data) ? data.data : []);
      }
    } catch (error) {
      console.error('Error fetching document catalog:', error);
      toast({
        title: 'Error',
        description: 'Failed to load required documents',
        variant: 'destructive'
      });
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleOpenCatalogEdit = (doc: CatalogDocument) => {
    setCatalogEditingDoc(doc);
    setCatalogEditForm({
      name: doc.name,
      description: doc.description || ''
    });
    setCatalogEditOpen(true);
  };

  const handleSaveCatalogEdit = async () => {
    if (!catalogEditingDoc) return;

    if (!catalogEditForm.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Document name is required',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_CATALOG_BY_ID(catalogEditingDoc.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: catalogEditForm.name.trim(),
          description: catalogEditForm.description.trim() ? catalogEditForm.description.trim() : null,
          is_active: catalogEditingDoc.is_active
        })
      });

      if (!response.ok) {
        let message = 'Failed to update document';
        try {
          const err = await response.json();
          if (err?.message) message = err.message;
        } catch (_) {}
        throw new Error(message);
      }

      setCatalogEditOpen(false);
      await fetchCatalogDocuments();
      await fetchRequirements();
      toast({
        title: 'Success',
        description: 'Required document updated successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update document',
        variant: 'destructive'
      });
    }
  };

  const handleToggleCatalogDocument = async (docId: number) => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_CATALOG_TOGGLE(docId), {
        method: 'PATCH',
        credentials: 'include'
      });

      if (!response.ok) {
        let message = 'Failed to toggle document status';
        try {
          const err = await response.json();
          if (err?.message) message = err.message;
        } catch (_) {}
        throw new Error(message);
      }

      await fetchCatalogDocuments();
      await fetchRequirements();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle document',
        variant: 'destructive'
      });
    }
  };

  const handleOpenAssignDialog = async (
    gradeLevel: string,
    mode: 'required' | 'additional'
  ) => {
    setAssignContext({ grade_level: gradeLevel });
    setAssignMode(mode);
    setAssignEnrollmentType('New Student');
    setAssignForm({
      document_ids: []
    });
    setAssignSearchQuery('');
    setAssignDialogOpen(true);
    await fetchCatalogDocuments();
  };

  const handleOpenDeleteDialog = (
    reqs: DocumentRequirement[],
    documentName: string,
    gradeLevel: string,
    enrollmentTypeLabel: string
  ) => {
    const ids = Array.from(new Set(reqs.map((r) => r.id)));
    if (ids.length === 0) return;

    setDeleteTarget({
      ids,
      documentName,
      gradeLevel,
      enrollmentTypeLabel,
    });
    setDeleteDialogOpen(true);
  };

  const handleOpenBulkDialog = async () => {
    setBulkForm({
      grade_levels: [],
      enrollment_type: 'all',
      document_ids: []
    });
    setBulkSearchQuery('');
    setBulkDialogOpen(true);
    await fetchCatalogDocuments();
  };

  const handleSubmitBulkAdd = async () => {
    if (bulkForm.grade_levels.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Select at least one grade level',
        variant: 'destructive'
      });
      return;
    }

    if (bulkForm.document_ids.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Select at least one required document',
        variant: 'destructive'
      });
      return;
    }

    try {
      setBulkSubmitting(true);

      const selectedDocuments = catalogDocuments.filter((doc) => bulkForm.document_ids.includes(String(doc.id)));
      const targetEnrollmentType = bulkForm.enrollment_type === 'all' ? null : bulkForm.enrollment_type;

      let createdCount = 0;
      let skippedCount = 0;

      for (const gradeLevel of bulkForm.grade_levels) {
        const gradeReqs = requirements.filter((r) => r.grade_level === gradeLevel);

        const sectionExistingReqs = gradeReqs.filter((r) => {
          if (targetEnrollmentType === null) return r.enrollment_type === null;
          return r.enrollment_type === targetEnrollmentType;
        });

        const existingNames = new Set(
          sectionExistingReqs.map((r) => r.document_name.toLowerCase().trim())
        );

        const allTypeNames = new Set(
          gradeReqs
            .filter((r) => r.enrollment_type === null)
            .map((r) => r.document_name.toLowerCase().trim())
        );

        let nextDisplayOrder = sectionExistingReqs.length > 0
          ? Math.max(...sectionExistingReqs.map((r) => Number(r.display_order) || 0)) + 1
          : 1;

        for (const selectedDocument of selectedDocuments) {
          const normalizedName = selectedDocument.name.toLowerCase().trim();

          if (existingNames.has(normalizedName)) {
            skippedCount++;
            continue;
          }

          if (targetEnrollmentType !== null && allTypeNames.has(normalizedName)) {
            skippedCount++;
            continue;
          }

          const payload = {
            grade_level: gradeLevel,
            enrollment_type: targetEnrollmentType,
            document_name: selectedDocument.name,
            description: selectedDocument.description,
            is_required: true,
            display_order: nextDisplayOrder,
            is_active: true
          };

          const response = await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            let message = 'Failed to add bulk requirements';
            try {
              const err = await response.json();
              if (err?.message) message = err.message;
            } catch (_) {}
            throw new Error(message);
          }

          createdCount++;
          nextDisplayOrder++;
          existingNames.add(normalizedName);
        }
      }

      if (createdCount === 0) {
        toast({
          title: 'No new items added',
          description: 'All selected documents are already assigned for the selected grade levels and enrollment type.',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Success',
        description: skippedCount > 0
          ? `${createdCount} requirement${createdCount > 1 ? 's' : ''} added, ${skippedCount} skipped.`
          : `${createdCount} requirement${createdCount > 1 ? 's' : ''} added successfully.`
      });

      setBulkDialogOpen(false);
      await fetchRequirements();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add bulk requirements',
        variant: 'destructive'
      });
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      setDeleteLoading(true);

      for (const id of deleteTarget.ids) {
        const response = await fetch(`${API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS}/${id}`, {
          method: 'DELETE',
          credentials: 'include'
        });

        if (!response.ok) {
          let message = 'Failed to delete requirement';
          try {
            const err = await response.json();
            if (err?.message) message = err.message;
          } catch (_) {}
          throw new Error(message);
        }
      }

      toast({
        title: 'Success',
        description: 'Requirement deleted successfully'
      });

      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      await fetchRequirements();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete requirement',
        variant: 'destructive'
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleAssignCatalogDocument = async () => {
    if (!assignContext) return;

    if (assignForm.document_ids.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one required document',
        variant: 'destructive'
      });
      return;
    }

    try {
      const targetEnrollmentType = assignMode === 'required' ? null : assignEnrollmentType;

      const sectionExistingReqs = requirements.filter((r) => {
        if (r.grade_level !== assignContext.grade_level) return false;
        if (targetEnrollmentType === null) return r.enrollment_type === null;
        return r.enrollment_type === targetEnrollmentType;
      });

      const allTypeNames = new Set(
        requirements
          .filter((r) => r.grade_level === assignContext.grade_level && r.enrollment_type === null)
          .map((r) => r.document_name.toLowerCase().trim())
      );

      const existingNames = new Set(sectionExistingReqs.map((r) => r.document_name.toLowerCase().trim()));
      let nextDisplayOrder = sectionExistingReqs.length > 0
        ? Math.max(...sectionExistingReqs.map((r) => Number(r.display_order) || 0)) + 1
        : 1;

      const selectedDocuments = catalogDocuments.filter((doc) => assignForm.document_ids.includes(String(doc.id)));
      const documentsToAdd = selectedDocuments.filter((doc) => {
        const normalizedName = doc.name.toLowerCase().trim();
        if (existingNames.has(normalizedName)) return false;
        if (targetEnrollmentType !== null && allTypeNames.has(normalizedName)) return false;
        return true;
      });

      if (documentsToAdd.length === 0) {
        toast({
          title: 'No new items added',
          description: 'Selected documents are already assigned in this enrollment type',
          variant: 'destructive'
        });
        return;
      }

      for (const selectedDocument of documentsToAdd) {
        const payload = {
          grade_level: assignContext.grade_level,
          enrollment_type: targetEnrollmentType,
          document_name: selectedDocument.name,
          description: selectedDocument.description,
          is_required: true,
          display_order: nextDisplayOrder,
          is_active: true
        };

        const response = await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          let message = 'Failed to add required document';
          try {
            const err = await response.json();
            if (err?.message) message = err.message;
          } catch (_) {}
          throw new Error(message);
        }

        nextDisplayOrder++;
      }

      toast({
        title: 'Success',
        description: `${documentsToAdd.length} document${documentsToAdd.length > 1 ? 's' : ''} added successfully`
      });

      setAssignDialogOpen(false);
      await fetchRequirements();
    } catch (error) {
      console.error('Error assigning catalog document:', error);
      toast({
        title: 'Error',
        description: 'Failed to add requirement',
        variant: 'destructive'
      });
    }
  };

  const handleOpenDialog = (requirement?: DocumentRequirement | { grade_level: string; document_name: string; types: (string | null)[]; allReqs: DocumentRequirement[] }) => {
    if (requirement && 'id' in requirement) {
      // Editing single requirement
      setEditingId(requirement.id);
      setIsEditingGroup(false);
      setIsDocumentCreateOnly(false);
      setFormData({
        grade_levels: [requirement.grade_level],
        enrollment_types: requirement.enrollment_type ? [requirement.enrollment_type] : [],
        document_name: requirement.document_name,
        is_required: Boolean(requirement.is_required),
        display_order: requirement.display_order,
        description: requirement.description || '',
        is_active: requirement.is_active
      });
    } else if (requirement && 'types' in requirement) {
      // Editing grouped document
      setEditingId(null);
      setIsEditingGroup(true);
      setIsDocumentCreateOnly(false);
      const firstReq = requirement.allReqs[0];
      // Only include active enrollment types in the checkbox selection
      const activeTypes = requirement.allReqs
        .filter(r => r.is_active && r.enrollment_type)
        .map(r => r.enrollment_type as string);
      
      setFormData({
        grade_levels: [requirement.grade_level],
        enrollment_types: activeTypes,
        document_name: requirement.document_name,
        is_required: Boolean(firstReq.is_required),
        display_order: firstReq.display_order,
        description: firstReq.description || '',
        is_active: firstReq.is_active
      });
    } else {
      setEditingId(null);
      setIsEditingGroup(false);
      setIsDocumentCreateOnly(true);
      setFormData({
        grade_levels: [],
        enrollment_types: [],
        document_name: '',
        is_required: true,
        display_order: 0,
        description: '',
        is_active: true
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.document_name) {
      toast({
        title: 'Validation Error',
        description: 'Document name is required',
        variant: 'destructive'
      });
      return;
    }

    try {
      if (isDocumentCreateOnly) {
        const response = await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_CATALOG, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            document_name: formData.document_name,
            description: formData.description.trim() ? formData.description.trim() : null,
            is_active: true
          })
        });

        if (!response.ok) {
          let message = 'Failed to create document';
          try {
            const err = await response.json();
            if (err?.message) message = err.message;
          } catch (_) {}
          throw new Error(message);
        }

        const data = await response.json();
        if (data.success) {
          toast({
            title: 'Success',
            description: 'Required document created successfully'
          });
        }
      } else if (isEditingGroup) {
        // Editing grouped document - activate/deactivate enrollment type variants per selected grade level
        if (formData.grade_levels.length === 0) {
          toast({
            title: 'Validation Error',
            description: 'At least one grade level is required',
            variant: 'destructive'
          });
          return;
        }

        for (const gradeLevel of formData.grade_levels) {
          const existingReqs = requirements.filter(
            r => r.grade_level === gradeLevel && r.document_name === formData.document_name
          );

          // If no types selected, it means "All Types" - activate the null type record
          if (formData.enrollment_types.length === 0) {
            // Deactivate all specific type records
            for (const req of existingReqs) {
              if (req.enrollment_type !== null && req.is_active) {
                await fetch(`${API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS}/${req.id}/toggle`, {
                  method: 'PATCH',
                  credentials: 'include'
                });
              }
            }

            // Activate or create/update the "All Types" (null) record
            const allTypesReq = existingReqs.find(r => r.enrollment_type === null);
            if (allTypesReq) {
              const updatePayload = {
                grade_level: gradeLevel,
                enrollment_type: null,
                document_name: formData.document_name,
                is_required: formData.is_required,
                display_order: formData.display_order,
                description: formData.description,
                is_active: true
              };

              const updateResponse = await fetch(`${API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS}/${allTypesReq.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatePayload)
              });

              if (!updateResponse.ok) {
                console.error(`Failed to update All Types requirement ${allTypesReq.id}:`, await updateResponse.text());
              }

              if (!allTypesReq.is_active) {
                await fetch(`${API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS}/${allTypesReq.id}/toggle`, {
                  method: 'PATCH',
                  credentials: 'include'
                });
              }
            } else {
              const payload = {
                grade_level: gradeLevel,
                enrollment_type: null,
                document_name: formData.document_name,
                is_required: formData.is_required,
                display_order: formData.display_order,
                description: formData.description,
                is_active: true
              };

              await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
              });
            }
          } else {
            const allTypesReq = existingReqs.find(r => r.enrollment_type === null);
            if (allTypesReq && allTypesReq.is_active) {
              await fetch(`${API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS}/${allTypesReq.id}/toggle`, {
                method: 'PATCH',
                credentials: 'include'
              });
            }

            for (const req of existingReqs) {
              if (req.enrollment_type !== null) {
                const shouldBeActive = formData.enrollment_types.includes(req.enrollment_type);

                if (req.is_active !== shouldBeActive) {
                  await fetch(`${API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS}/${req.id}/toggle`, {
                    method: 'PATCH',
                    credentials: 'include'
                  });
                }

                if (shouldBeActive) {
                  const updatePayload = {
                    grade_level: gradeLevel,
                    enrollment_type: req.enrollment_type,
                    document_name: formData.document_name,
                    is_required: formData.is_required,
                    display_order: formData.display_order,
                    description: formData.description,
                    is_active: true
                  };

                  const updateResponse = await fetch(`${API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS}/${req.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(updatePayload)
                  });

                  if (!updateResponse.ok) {
                    console.error(`Failed to update requirement ${req.id}:`, await updateResponse.text());
                  }
                }
              }
            }

            for (const type of formData.enrollment_types) {
              const exists = existingReqs.some(r => r.enrollment_type === type);
              if (!exists) {
                const payload = {
                  grade_level: gradeLevel,
                  enrollment_type: type,
                  document_name: formData.document_name,
                  is_required: formData.is_required,
                  display_order: formData.display_order,
                  description: formData.description,
                  is_active: true
                };

                await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify(payload)
                });
              }
            }
          }
        }

        toast({
          title: 'Success',
          description: 'Requirements updated successfully'
        });
      } else if (editingId) {
        if (formData.grade_levels.length !== 1) {
          toast({
            title: 'Validation Error',
            description: 'Single requirement edit supports exactly one grade level. Use Add for multi-level creation.',
            variant: 'destructive'
          });
          return;
        }

        // Update single requirement
        const payload = {
          ...formData,
          grade_level: formData.grade_levels[0],
          enrollment_type: formData.enrollment_types[0] || null
        };

        const response = await fetch(`${API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS}/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Failed to update requirement');
        
        const data = await response.json();
        if (data.success) {
          toast({
            title: 'Success',
            description: 'Requirement updated successfully'
          });
        }
      } else {
        // Fallback: create new requirements (one for each selected type)
        if (formData.grade_levels.length === 0) {
          toast({
            title: 'Validation Error',
            description: 'At least one grade level is required',
            variant: 'destructive'
          });
          return;
        }

        const typesToSave = formData.enrollment_types.length > 0 
          ? formData.enrollment_types 
          : [null];

        for (const gradeLevel of formData.grade_levels) {
          for (const enrollmentType of typesToSave) {
            const payload = {
              grade_level: gradeLevel,
              enrollment_type: enrollmentType,
              document_name: formData.document_name,
              is_required: formData.is_required,
              display_order: formData.display_order,
              description: formData.description,
              is_active: true
            };

            const response = await fetch(API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to create requirement');
          }
        }

        toast({
          title: 'Success',
          description: `${formData.grade_levels.length * typesToSave.length} requirement${(formData.grade_levels.length * typesToSave.length) > 1 ? 's' : ''} created successfully`
        });
      }
      
      setDialogOpen(false);
      fetchRequirements();
    } catch (error) {
      console.error('Error saving requirement:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save requirement',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this requirement?')) return;

    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS}/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to delete requirement');

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Requirement deleted successfully'
        });
        fetchRequirements();
      }
    } catch (error) {
      console.error('Error deleting requirement:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete requirement',
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.ADMIN_DOCUMENT_REQUIREMENTS}/${id}/toggle`, {
        method: 'PATCH',
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to toggle status');

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Status updated successfully'
        });
        fetchRequirements();
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive'
      });
    }
  };

  const filteredRequirements = requirements.filter(req => {
    if (filterGrade !== 'all' && req.grade_level !== filterGrade) return false;
    if (filterType !== 'all') {
      if (filterType === 'general' && req.enrollment_type !== null) return false;
      if (filterType !== 'general' && req.enrollment_type !== filterType) return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = req.document_name.toLowerCase().includes(query);
      const matchesGrade = req.grade_level.toLowerCase().includes(query);
      const matchesType = req.enrollment_type && req.enrollment_type.toLowerCase().includes(query);
      if (!matchesName && !matchesGrade && !matchesType) return false;
    }
    return true;
  });

  const displayGradeLevels = yearLevels.length > 0 ? yearLevels : GRADE_LEVELS;

  const availableCatalogDocuments = (() => {
    if (!assignContext) return [] as CatalogDocument[];

    const targetEnrollmentType = assignMode === 'required' ? null : assignEnrollmentType;

    const currentGradeReqs = requirements.filter((r) => r.grade_level === assignContext.grade_level);
    const targetTypeReqs = currentGradeReqs.filter((r) => {
      if (targetEnrollmentType === null) return r.enrollment_type === null;
      return r.enrollment_type === targetEnrollmentType;
    });
    const allTypeReqs = currentGradeReqs.filter((r) => r.enrollment_type === null);

    const selectedInTarget = new Set(targetTypeReqs.map((r) => r.document_name.toLowerCase().trim()));
    const selectedInAllType = new Set(allTypeReqs.map((r) => r.document_name.toLowerCase().trim()));

    return catalogDocuments.filter((doc) => {
      if (!doc.is_active) return false;

      const normalizedName = doc.name.toLowerCase().trim();

      if (selectedInTarget.has(normalizedName)) return false;

      if (targetEnrollmentType !== null && selectedInAllType.has(normalizedName)) {
        return false;
      }

      return true;
    });
  })();

  const availableBulkCatalogDocuments = (() => {
    const activeDocs = catalogDocuments.filter((doc) => doc.is_active);
    if (bulkForm.grade_levels.length === 0) return activeDocs;

    const targetEnrollmentType = bulkForm.enrollment_type === 'all' ? null : bulkForm.enrollment_type;

    return activeDocs.filter((doc) => {
      const normalizedName = doc.name.toLowerCase().trim();

      return bulkForm.grade_levels.some((gradeLevel) => {
        const gradeReqs = requirements.filter((r) => r.grade_level === gradeLevel);

        const existsInTarget = gradeReqs.some((r) => {
          if (targetEnrollmentType === null) {
            return r.enrollment_type === null && r.document_name.toLowerCase().trim() === normalizedName;
          }
          return r.enrollment_type === targetEnrollmentType && r.document_name.toLowerCase().trim() === normalizedName;
        });

        if (existsInTarget) return false;

        if (targetEnrollmentType !== null) {
          const existsInAllTypes = gradeReqs.some(
            (r) => r.enrollment_type === null && r.document_name.toLowerCase().trim() === normalizedName
          );
          if (existsInAllTypes) return false;
        }

        return true;
      });
    });
  })();

  const filteredAssignCatalogDocuments = availableCatalogDocuments.filter((doc) => {
    const query = assignSearchQuery.trim().toLowerCase();
    if (!query) return true;

    const nameMatch = doc.name.toLowerCase().includes(query);
    const codeMatch = doc.code?.toLowerCase().includes(query);
    const descriptionMatch = (doc.description || '').toLowerCase().includes(query);

    return nameMatch || codeMatch || descriptionMatch;
  });

  const filteredBulkCatalogDocuments = availableBulkCatalogDocuments.filter((doc) => {
    const query = bulkSearchQuery.trim().toLowerCase();
    if (!query) return true;

    const nameMatch = doc.name.toLowerCase().includes(query);
    const codeMatch = doc.code?.toLowerCase().includes(query);
    const descriptionMatch = (doc.description || '').toLowerCase().includes(query);

    return nameMatch || codeMatch || descriptionMatch;
  });

  const requirementsByGradeRows = displayGradeLevels
    .map((gradeLevel) => {
      const gradeReqs = filteredRequirements.filter((r) => r.grade_level === gradeLevel);

      const requiredDocuments = gradeReqs.filter((r) => r.enrollment_type === null);
      const additionalDocuments = gradeReqs.filter((r) => r.enrollment_type !== null);

      return {
        gradeLevel,
        requiredDocuments,
        additionalDocuments,
      };
    });

  const content = (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader className="border-b pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Document Requirements ({filteredRequirements.length})</CardTitle>
              <CardDescription className="text-base">Manage required documents by grade level and enrollment type</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleOpenBulkDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Bulk
              </Button>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Document
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Grade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grades</SelectItem>
                {displayGradeLevels.map(grade => (
                  <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="general">General (All Types)</SelectItem>
                {ENROLLMENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                setSearchQuery('');
                setFilterGrade('all');
                setFilterType('all');
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const next = !showManageDocuments;
                  setShowManageDocuments(next);
                  if (next) {
                    await fetchCatalogDocuments();
                  }
                }}
              >
                {showManageDocuments ? 'Hide Manage Documents' : 'Manage Documents'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {showManageDocuments && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Required Documents</CardTitle>
            <CardDescription>Edit required document catalog items without leaving this page</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-sm text-muted-foreground">Loading required documents...</td>
                    </tr>
                  ) : catalogDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-sm text-muted-foreground">No required documents found.</td>
                    </tr>
                  ) : (
                    catalogDocuments.map((doc) => (
                      <tr key={doc.id} className="border-b last:border-b-0">
                        <td className="px-3 py-3 text-sm font-medium">{doc.name}</td>
                        <td className="px-3 py-3 text-sm text-muted-foreground">{doc.description || '—'}</td>
                        <td className="px-3 py-3">
                          <Badge variant={doc.is_active ? 'default' : 'secondary'}>
                            {doc.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleOpenCatalogEdit(doc)}>
                              Edit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleToggleCatalogDocument(doc.id)}>
                              {doc.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requirements List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading requirements...</p>
          </CardContent>
        </Card>
      ) : requirementsByGradeRows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No requirements found</p>
            <p className="text-sm text-muted-foreground mt-2">
              {searchQuery ? 'Try a different search term' : 'Add document requirements to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg border-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grade Level</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents Required</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Additional Document</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requirementsByGradeRows.map((row) => (
                    <tr key={row.gradeLevel} className="hover:bg-muted/20">
                      <td className="px-4 py-3 align-top">
                        <Badge variant="outline" className="font-medium">{row.gradeLevel}</Badge>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="group rounded-lg border border-gray-200 p-2.5 bg-gray-50/40">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-gray-700">All Types</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleOpenAssignDialog(row.gradeLevel, 'required')}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Item
                            </Button>
                          </div>

                          {row.requiredDocuments.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">None</p>
                          ) : (
                            <div className="space-y-2">
                              {Object.entries(
                                row.requiredDocuments.reduce((acc, req) => {
                                  if (!acc[req.document_name]) acc[req.document_name] = [];
                                  acc[req.document_name].push(req);
                                  return acc;
                                }, {} as Record<string, DocumentRequirement[]>)
                              ).map(([documentName, reqs]) => {
                                const firstReq = reqs[0];
                                const hasActive = reqs.some((r) => r.is_active);

                                return (
                                  <div key={`${row.gradeLevel}-required-${documentName}`} className="rounded-md border bg-white p-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">{documentName}</p>
                                        <div className="flex gap-1 mt-1">
                                          {firstReq.is_required ? (
                                            <Badge className="bg-red-100 text-red-800 text-[10px] px-1.5 py-0">Required</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Optional</Badge>
                                          )}
                                          {hasActive ? (
                                            <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">Active</Badge>
                                          ) : (
                                            <Badge variant="outline" className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0">Inactive</Badge>
                                          )}
                                        </div>
                                      </div>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleOpenDeleteDialog(reqs, documentName, row.gradeLevel, 'All Types')}
                                        className="h-6 w-6 hover:bg-red-100 shrink-0"
                                        title="Delete requirement"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="group rounded-lg border border-gray-200 p-2.5 bg-gray-50/40">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-gray-700">By Enrollment Type</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleOpenAssignDialog(row.gradeLevel, 'additional')}
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Item
                            </Button>
                          </div>

                          {row.additionalDocuments.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">None</p>
                          ) : (
                            <div className="space-y-2">
                              {Object.entries(
                                row.additionalDocuments.reduce((acc, req) => {
                                  const key = `${req.document_name}__${req.enrollment_type}`;
                                  if (!acc[key]) acc[key] = [];
                                  acc[key].push(req);
                                  return acc;
                                }, {} as Record<string, DocumentRequirement[]>)
                              ).map(([key, reqs]) => {
                                const firstReq = reqs[0];
                                const hasActive = reqs.some((r) => r.is_active);
                                const documentName = firstReq.document_name;
                                const enrollmentTypeLabel = firstReq.enrollment_type || 'Additional';

                                return (
                                  <div key={`${row.gradeLevel}-additional-${key}`} className="rounded-md border bg-white p-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-gray-900 truncate">{documentName}</p>
                                        <div className="flex gap-1 mt-1 flex-wrap">
                                          <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0">{enrollmentTypeLabel}</Badge>
                                          {hasActive ? (
                                            <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">Active</Badge>
                                          ) : (
                                            <Badge variant="outline" className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0">Inactive</Badge>
                                          )}
                                        </div>
                                      </div>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => handleOpenDeleteDialog(reqs, documentName, row.gradeLevel, enrollmentTypeLabel)}
                                        className="h-6 w-6 hover:bg-red-100 shrink-0"
                                        title="Delete requirement"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isDocumentCreateOnly
                  ? 'Create Required Document'
                  : (editingId || isEditingGroup)
                    ? 'Edit Requirement'
                    : 'Add New Requirement'}
              </DialogTitle>
              <DialogDescription>
                {isDocumentCreateOnly
                  ? 'Create a required document entry in your document catalog'
                  : 'Define document requirements for enrollment'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!isDocumentCreateOnly && (
                <>
                  <div>
                    <Label>Grade Levels *</Label>
                    <div className="mt-2 p-4 border rounded-md space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {displayGradeLevels.map((grade) => {
                          const selected = formData.grade_levels.includes(grade);
                          return (
                            <button
                              key={grade}
                              type="button"
                              onClick={() => {
                                if (selected) {
                                  setFormData({
                                    ...formData,
                                    grade_levels: formData.grade_levels.filter(g => g !== grade)
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    grade_levels: [...formData.grade_levels, grade]
                                  });
                                }
                              }}
                              className={`px-3 py-1 rounded-lg text-sm font-medium border transition-all ${
                                selected
                                  ? 'bg-green-600 text-white border-green-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                              }`}
                            >
                              {grade}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Enrollment Types</Label>
                    <div className="mt-2 p-4 border rounded-md space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="type-all"
                          checked={formData.enrollment_types.length === 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFormData({ ...formData, enrollment_types: [] });
                            }
                          }}
                        />
                        <label
                          htmlFor="type-all"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          All Types
                        </label>
                      </div>
                      {ENROLLMENT_TYPES.map(type => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${type}`}
                            checked={formData.enrollment_types.includes(type)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({ 
                                  ...formData, 
                                  enrollment_types: [...formData.enrollment_types, type] 
                                });
                              } else {
                                setFormData({ 
                                  ...formData, 
                                  enrollment_types: formData.enrollment_types.filter(t => t !== type) 
                                });
                              }
                            }}
                          />
                          <label
                            htmlFor={`type-${type}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {type}
                          </label>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select specific types or leave unchecked for all types
                    </p>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="document_name">Document Name *</Label>
                <Input
                  id="document_name"
                  value={formData.document_name}
                  onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
                  placeholder="e.g., Birth Certificate, Form 137"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., For age verification"
                  className="mt-2"
                  rows={2}
                />
              </div>

              {!isDocumentCreateOnly && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="display_order">Display Order</Label>
                    <Input
                      id="display_order"
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="is_required">Required?</Label>
                    <Select
                      value={formData.is_required.toString()}
                      onValueChange={(value) => setFormData({ ...formData, is_required: value === 'true' })}
                    >
                      <SelectTrigger id="is_required" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Required</SelectItem>
                        <SelectItem value="false">Optional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                {isDocumentCreateOnly
                  ? 'Create Document'
                  : (editingId || isEditingGroup)
                    ? 'Update'
                    : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-lg overflow-hidden">
            <DialogHeader>
              <DialogTitle>{assignMode === 'required' ? 'Add Required Document' : 'Add Additional Document'}</DialogTitle>
              <DialogDescription>
                {assignContext
                  ? assignMode === 'required'
                    ? `Add required document to ${assignContext.grade_level} (All Types)`
                    : `Add additional document to ${assignContext.grade_level} (${assignEnrollmentType})`
                  : 'Select a required document to add as requirement'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {assignMode === 'additional' && (
                <div>
                  <Label>Enrollment Type *</Label>
                  <Select
                    value={assignEnrollmentType}
                    onValueChange={(value: 'New Student' | 'Returning Student' | 'Transferee') => {
                      setAssignEnrollmentType(value);
                      setAssignForm({ document_ids: [] });
                    }}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select enrollment type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENROLLMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Required Documents *</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={assignSearchQuery}
                    onChange={(e) => setAssignSearchQuery(e.target.value)}
                    placeholder={assignMode === 'required' ? 'Search required documents...' : 'Search additional documents...'}
                    className="pl-10"
                  />
                </div>
                <div className="mt-2 max-h-60 overflow-y-auto overflow-x-hidden rounded-md border p-2 space-y-2">
                  {catalogLoading ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">Loading documents...</p>
                  ) : filteredAssignCatalogDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">No available documents to add.</p>
                  ) : (
                    filteredAssignCatalogDocuments.map((doc) => {
                      const selected = assignForm.document_ids.includes(String(doc.id));
                      return (
                        <label
                          key={doc.id}
                          className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition overflow-hidden ${
                            selected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setAssignForm((prev) => ({
                                  ...prev,
                                  document_ids: Array.from(new Set([...prev.document_ids, String(doc.id)]))
                                }));
                              } else {
                                setAssignForm((prev) => ({
                                  ...prev,
                                  document_ids: prev.document_ids.filter((id) => id !== String(doc.id))
                                }));
                              }
                            }}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium break-words leading-5">{doc.name}</p>
                              {doc.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 break-words leading-4">{doc.description}</p>
                              )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {assignForm.document_ids.length} selected • Display order is assigned automatically
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignCatalogDocument}>
                Add Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="sm:max-w-2xl overflow-hidden">
            <DialogHeader>
              <DialogTitle>Add Bulk Requirements</DialogTitle>
              <DialogDescription>
                Select grade levels, enrollment type, and required documents for faster population.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label>Grade Levels *</Label>
                <div className="mt-2 max-h-36 overflow-y-auto rounded-md border p-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {displayGradeLevels.map((grade) => {
                      const checked = bulkForm.grade_levels.includes(grade);
                      return (
                        <label key={grade} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              if (value) {
                                setBulkForm((prev) => ({
                                  ...prev,
                                  grade_levels: Array.from(new Set([...prev.grade_levels, grade]))
                                }));
                              } else {
                                setBulkForm((prev) => ({
                                  ...prev,
                                  grade_levels: prev.grade_levels.filter((g) => g !== grade)
                                }));
                              }
                            }}
                          />
                          <span>{grade}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <Label>Enrollment Type *</Label>
                <Select
                  value={bulkForm.enrollment_type}
                  onValueChange={(value: 'all' | 'New Student' | 'Returning Student' | 'Transferee') =>
                    setBulkForm((prev) => ({ ...prev, enrollment_type: value, document_ids: [] }))
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select enrollment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {ENROLLMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Required Documents *</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={bulkSearchQuery}
                    onChange={(e) => setBulkSearchQuery(e.target.value)}
                    placeholder="Search required documents..."
                    className="pl-10"
                  />
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto overflow-x-hidden rounded-md border p-2 space-y-2">
                  {catalogLoading ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">Loading documents...</p>
                  ) : filteredBulkCatalogDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-1">No available documents for the selected grade levels and enrollment type.</p>
                  ) : (
                    filteredBulkCatalogDocuments.map((doc) => {
                      const selected = bulkForm.document_ids.includes(String(doc.id));
                      return (
                        <label
                          key={doc.id}
                          className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 cursor-pointer transition overflow-hidden ${
                            selected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            checked={selected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setBulkForm((prev) => ({
                                  ...prev,
                                  document_ids: Array.from(new Set([...prev.document_ids, String(doc.id)]))
                                }));
                              } else {
                                setBulkForm((prev) => ({
                                  ...prev,
                                  document_ids: prev.document_ids.filter((id) => id !== String(doc.id))
                                }));
                              }
                            }}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium break-words leading-5">{doc.name}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 break-words leading-4">{doc.description}</p>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {bulkForm.grade_levels.length} grade level{bulkForm.grade_levels.length !== 1 ? 's' : ''} selected • {bulkForm.document_ids.length} document{bulkForm.document_ids.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)} disabled={bulkSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmitBulkAdd} disabled={bulkSubmitting}>
                {bulkSubmitting ? 'Adding...' : 'Add Bulk'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Requirement</DialogTitle>
              <DialogDescription>
                {deleteTarget
                  ? `Delete "${deleteTarget.documentName}" from ${deleteTarget.gradeLevel} (${deleteTarget.enrollmentTypeLabel})?`
                  : 'Confirm requirement deletion.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeleteTarget(null);
                }}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={catalogEditOpen} onOpenChange={setCatalogEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Required Document</DialogTitle>
              <DialogDescription>Update document details in the catalog</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="catalog-edit-name">Document Name *</Label>
                <Input
                  id="catalog-edit-name"
                  className="mt-2"
                  value={catalogEditForm.name}
                  onChange={(e) => setCatalogEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="catalog-edit-description">Description</Label>
                <Textarea
                  id="catalog-edit-description"
                  className="mt-2"
                  rows={3}
                  value={catalogEditForm.description}
                  onChange={(e) => setCatalogEditForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCatalogEditOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveCatalogEdit}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
}
