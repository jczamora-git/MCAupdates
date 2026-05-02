<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Learning Materials Model
 * Handles all learning materials related database operations
 */
class LearningMaterials_model extends Model
{
    protected $table = 'learning_materials';

    /**
     * Create new learning material
     * 
     * @param array $data Learning material data
     * @return int|false Insert ID or false on failure
     */
    public function create($data)
    {
        $data['created_at'] = app_now();
        
        return $this->db->table($this->table)
                        ->insert($data);
    }

    /**
     * Get learning materials by subject and section
     * 
     * @param int $subjectId Subject ID
     * @param int|null $sectionId Optional section ID filter
     * @return array Learning materials
     */
    public function getBySubject($subjectId, $sectionId = null, $schoolYear = null)
    {
        $query = $this->db->table($this->table)
                          ->where('subject_id', $subjectId);

        if ($sectionId !== null) {
            $query = $query->where('section_id', $sectionId);
        }

        if ($schoolYear !== null) {
            $query = $query->where('school_year', $schoolYear);
        }

        return $query->order_by('created_at', 'DESC')
                     ->get_all();
    }

    /**
     * Get single learning material by ID
     * 
     * @param int $id Material ID
     * @return array|null Learning material or null
     */
    public function getById($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->get();
    }

    /**
     * Update learning material
     * 
     * @param int $id Material ID
     * @param array $data Update data
     * @return bool Success status
     */
    public function update($id, $data)
    {
        $data['updated_at'] = app_now();
        
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->update($data);
    }

    /**
     * Delete learning material
     * 
     * @param int $id Material ID
     * @return bool Success status
     */
    public function delete($id)
    {
        return $this->db->table($this->table)
                        ->where('id', $id)
                        ->delete();
    }

    /**
     * Get materials by section
     * 
     * @param int $sectionId Section ID
     * @return array Learning materials
     */
    public function getBySection($sectionId)
    {
        return $this->db->table($this->table)
                        ->where('section_id', $sectionId)
                        ->order_by('created_at', 'DESC')
                        ->get_all();
    }

    /**
     * Get materials by type
     * 
     * @param int $subjectId Subject ID
     * @param string $type Material type (text|file|link)
     * @return array Learning materials
     */
    public function getByType($subjectId, $type)
    {
        return $this->db->table($this->table)
                        ->where('subject_id', $subjectId)
                        ->where('type', $type)
                        ->order_by('created_at', 'DESC')
                        ->get_all();
    }

    /**
     * Get materials created by user
     * 
     * @param int $userId User ID
     * @return array Learning materials
     */
    public function getByCreator($userId)
    {
        return $this->db->table($this->table)
                        ->where('created_by', $userId)
                        ->order_by('created_at', 'DESC')
                        ->get_all();
    }

    /**
     * Search materials by title
     * 
     * @param int $subjectId Subject ID
     * @param string $search Search term
     * @return array Learning materials
     */
    public function search($subjectId, $search)
    {
        $searchTerm = '%' . $search . '%';
        
        return $this->db->table($this->table)
                        ->where('subject_id', $subjectId)
                        ->like('title', $searchTerm)
                        ->order_by('created_at', 'DESC')
                        ->get_all();
    }
}
