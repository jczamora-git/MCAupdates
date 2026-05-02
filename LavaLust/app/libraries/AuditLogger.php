<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * AuditLogger
 * 
 * Reusable service for creating audit log entries
 * Can be used independently or combined with NotificationService
 * 
 * @package     LavaLust
 * @subpackage  Libraries
 * @category    Audit Logging
 */
class AuditLogger
{
    protected $db;
    protected $lava;
    
    public function __construct()
    {
        $this->lava =& lava_instance();
        $this->lava->call->database();
        $this->db = $this->lava->db;
    }
    
    /**
     * Log an action with full audit trail
     * 
     * @param array $params Audit log parameters
     * @return int|false Audit log ID or false on failure
     */
    public function log($params)
    {
        // Validate required fields
        if (empty($params['action']) || empty($params['entity_type'])) {
            error_log('AuditLogger: Missing required fields (action, entity_type)');
            return false;
        }
        
        try {
            $now = app_now();

            $data = [
                'actor_user_id' => $params['actor_user_id'] ?? null,
                'actor_role' => $params['actor_role'] ?? 'system',
                'actor_name' => $params['actor_name'] ?? null,
                'action' => $params['action'],
                'entity_type' => $params['entity_type'],
                'entity_id' => $params['entity_id'] ?? null,
                'description' => $params['description'] ?? null,
                'metadata' => isset($params['metadata']) ? json_encode($params['metadata']) : null,
                'ip_address' => $this->getIpAddress(),
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
                'created_at' => $now,
            ];
            
            $result = $this->db->table('audit_logs')->insert($data);
            
            if ($result) {
                $insert_id = $this->db->last_id();
                error_log("AuditLogger: Created audit log #{$insert_id} - {$params['action']} on {$params['entity_type']}");
                return $insert_id;
            }
            
            error_log('AuditLogger: Insert failed');
            return false;
            
        } catch (Throwable $e) {
            error_log('AuditLogger error: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get client IP address
     */
    private function getIpAddress()
    {
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            return $_SERVER['HTTP_CLIENT_IP'];
        } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            return $_SERVER['HTTP_X_FORWARDED_FOR'];
        } else {
            return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
        }
    }

    /**
     * Quick helper for common CRUD operations
     */
    public function logCreate($entityType, $entityId, $actorUserId = null, $actorRole = null, $description = null)
    {
        return $this->log([
            'action' => 'create',
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'actor_user_id' => $actorUserId,
            'actor_role' => $actorRole,
            'description' => $description
        ]);
    }
    
    public function logUpdate($entityType, $entityId, $actorUserId = null, $actorRole = null, $description = null)
    {
        return $this->log([
            'action' => 'update',
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'actor_user_id' => $actorUserId,
            'actor_role' => $actorRole,
            'description' => $description
        ]);
    }
    
    public function logDelete($entityType, $entityId, $actorUserId = null, $actorRole = null, $description = null)
    {
        return $this->log([
            'action' => 'delete',
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'actor_user_id' => $actorUserId,
            'actor_role' => $actorRole,
            'description' => $description
        ]);
    }
    
    public function logRead($entityType, $entityId, $actorUserId = null, $actorRole = null, $description = null)
    {
        return $this->log([
            'action' => 'read',
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'actor_user_id' => $actorUserId,
            'actor_role' => $actorRole,
            'description' => $description
        ]);
    }
}
