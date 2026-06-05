import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { DocumentBlockService } from './document-block.service';
import { DocumentService } from './document.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'documents',
})
export class DocumentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger(DocumentsGateway.name);

  // Map: userId → Set of socket IDs (users can have multiple tabs)
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private docBlockService: DocumentBlockService,
    private docService: DocumentService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.debug(`Socket connection attempt: ${client.id}`);
    try {
      const token =
        client.handshake.auth?.token || client.handshake.query?.token;
      
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided (socket: ${client.id})`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token as string, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (!payload || !payload.sub) {
        this.logger.warn(`Connection rejected: Invalid token payload (socket: ${client.id})`);
        client.disconnect();
        return;
      }

      // Store socket ↔ user mapping
      const userId = payload.sub;
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      client.data.user = { userId, email: payload.email };

      this.logger.log(`User ${payload.email} connected (socket: ${client.id})`);
    } catch (err) {
      this.logger.error(`Connection rejected: Auth error - ${err instanceof Error ? err.message : 'Unknown error'} (socket: ${client.id})`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.userId;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }
    this.logger.log(`User disconnected: ${client.data.user?.email || 'Unknown'} (socket: ${client.id}), all rooms left automatically`);
  }

  // ─────────────────────────────────────────────────────────────
  // Document-level events (existing)
  // ─────────────────────────────────────────────────────────────

  @SubscribeMessage('join_document')
  handleJoinDocument(
    @MessageBody() data: { documentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.documentId);
    this.logger.log(
      `User ${client.data.user?.email} joined document: ${data.documentId}`,
    );

    // Notify others in the room
    client.broadcast.to(data.documentId).emit('user_joined', {
      userId: client.data.user.userId,
      email: client.data.user.email,
    });

    this.logger.debug(`Client ${client.id} is now in rooms: ${Array.from(client.rooms)}`);
  }

  @SubscribeMessage('leave_document')
  handleLeaveDocument(
    @MessageBody() data: { documentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(data.documentId);
    this.logger.log(
      `User ${client.data.user?.email} left document: ${data.documentId}`,
    );

    // Notify others
    client.broadcast.to(data.documentId).emit('user_left', {
      userId: client.data.user.userId,
      email: client.data.user.email,
    });
  }

  @SubscribeMessage('title_update')
  async handleTitleUpdate(
    @MessageBody() data: { documentId: string; title: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user.userId;
    this.logger.debug(
      `Received title_update: documentId=${data.documentId} title="${data.title}" from user ${userId}`,
    );

    try {
      const updated = await this.docService.updateDocument(
        data.documentId,
        userId,
        { title: data.title },
      );

      this.logger.log(
        `Title updated via WebSocket: doc=${data.documentId} → "${data.title}"`,
      );

      // Broadcast to all users in the document room (including sender for confirmation)
      this.server.to(data.documentId).emit('title_updated', {
        documentId: data.documentId,
        title: updated.title,
        updatedBy: userId,
        email: client.data.user.email,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update title for document ${data.documentId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @SubscribeMessage('block_update')
  async handleBlockUpdate(
    @MessageBody() data: { documentId: string; blockId: string; content: any },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user.userId;
    this.logger.debug(
      `Received block_update: ${JSON.stringify(data)} from user ${userId}`,
    );

    // 1. Persist change to Database
    try {
      await this.docBlockService.update(data.blockId, data.documentId, userId, {
        content: data.content,
      });
      this.logger.debug(`Successfully persisted block_update: ${data.blockId}`);
    } catch (error) {
      this.logger.error(
        `Failed to persist block update: ${data.blockId}. Data: ${JSON.stringify(data)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    // 2. Broadcast to other users in the room
    client.broadcast.to(data.documentId).emit('block_updated', {
      blockId: data.blockId,
      content: data.content,
      updatedBy: userId,
      email: client.data.user.email,
    });
  }

  @SubscribeMessage('block_create')
  async handleBlockCreate(
    @MessageBody()
    data: {
      documentId: string;
      type: string;
      content?: any;
      position?: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user.userId;
    this.logger.debug(
      `Received block_create: ${JSON.stringify(data)} from user ${userId}`,
    );

    try {
      const newBlock = await this.docBlockService.create(
        data.documentId,
        userId,
        {
          type: data.type as any,
          content: data.content,
          position: data.position,
        },
      );

      this.logger.log(
        `Block created via WebSocket: ${newBlock.id} (doc: ${data.documentId})`,
      );

      // Notify all users in the document room
      this.server.to(data.documentId).emit('block_created', newBlock);
    } catch (error) {
      this.logger.error(
        `Failed to create block via WebSocket. Data: ${JSON.stringify(data)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @SubscribeMessage('block_delete')
  async handleBlockDelete(
    @MessageBody() data: { documentId: string; blockId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user.userId;
    this.logger.debug(
      `Received block_delete: blockId=${data.blockId} from user ${userId}`,
    );

    try {
      await this.docBlockService.remove(data.blockId, data.documentId, userId);

      this.logger.log(
        `Block deleted via WebSocket: ${data.blockId} (doc: ${data.documentId})`,
      );

      // Broadcast to all users (including sender so their UI confirms deletion)
      this.server.to(data.documentId).emit('block_deleted', {
        blockId: data.blockId,
        deletedBy: userId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete block ${data.blockId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @SubscribeMessage('block_reorder')
  async handleBlockReorder(
    @MessageBody()
    data: {
      documentId: string;
      blockId: string;
      newPosition: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user.userId;
    this.logger.debug(
      `Received block_reorder: blockId=${data.blockId} newPosition=${data.newPosition} from user ${userId}`,
    );

    try {
      await this.docBlockService.update(
        data.blockId,
        data.documentId,
        userId,
        { position: data.newPosition },
      );

      // Fetch ALL blocks with their updated positions so clients can fully reconcile
      const allBlocks = await this.docBlockService.findAll(
        data.documentId,
        userId,
      );

      this.logger.log(
        `Block reordered via WebSocket: ${data.blockId} → position ${data.newPosition}`,
      );

      // Broadcast full block list to all clients in the room
      this.server.to(data.documentId).emit('blocks_reordered', {
        documentId: data.documentId,
        blocks: allBlocks,
        reorderedBy: userId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to reorder block ${data.blockId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ✨ NEW: Workspace-level events
  // ─────────────────────────────────────────────────────────────

  /**
   * Join workspace room to receive member/document updates
   */
  @SubscribeMessage('join_workspace')
  handleJoinWorkspace(
    @MessageBody() data: { workspaceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`workspace:${data.workspaceId}`);
    this.logger.log(
      `User ${client.data.user?.email} joined workspace: ${data.workspaceId}`,
    );
  }

  /**
   * Listen for invite accepted event → notify specific user
   */
  @OnEvent('workspace.invite.accepted')
  handleInviteAccepted(payload: {
    targetUserId: string;
    workspaceId: string;
    workspaceName: string;
    invitedBy: string;
    role: string;
    timestamp: string;
  }) {
    this.emitToUser(payload.targetUserId, 'workspace_invite_accepted', {
      workspaceId: payload.workspaceId,
      workspaceName: payload.workspaceName,
      invitedBy: payload.invitedBy,
      role: payload.role,
      timestamp: payload.timestamp,
    });
  }

  /**
   * Listen for member added event → notify workspace members
   */
  @OnEvent('workspace.member.added')
  handleMemberAdded(payload: {
    workspaceId: string;
    userId: string;
    email: string;
    name: string;
    role: string;
    addedBy: string;
  }) {
    this.emitToWorkspace(
      payload.workspaceId,
      'workspace_member_added',
      {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        addedBy: payload.addedBy,
      },
      payload.addedBy,
    ); // Exclude the inviter
  }

  /**
   * Emit to a specific user (by userId) - for invite notifications
   */
  emitToUser(userId: string, event: string, payload: any) {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds) {
      this.logger.debug(`User ${userId} not online, skipping emit`);
      return;
    }

    socketIds.forEach((socketId) => {
      const client = this.server.sockets.sockets.get(socketId);
      if (client) {
        client.emit(event, payload);
        this.logger.debug(
          `Emitted ${event} to user ${userId} (socket: ${socketId})`,
        );
      }
    });
  }

  /**
   * Emit to all members of a workspace
   */
  emitToWorkspace(
    workspaceId: string,
    event: string,
    payload: any,
    excludeUserId?: string, // ✅ Optional parameter to skip a user
  ) {
    // Get all sockets in the workspace room
    const room = `workspace:${workspaceId}`;
    const sockets = this.server.sockets.adapter.rooms.get(room);

    if (!sockets) return;

    // Emit to each socket, optionally excluding one user
    sockets.forEach((socketId) => {
      const client = this.server.sockets.sockets.get(socketId);
      if (client) {
        const userId = client.data.user?.userId;
        // Skip if this is the excluded user
        if (excludeUserId && userId === excludeUserId) {
          return;
        }
        client.emit(event, payload);
      }
    });

    this.logger.debug(
      `Emitted ${event} to workspace ${workspaceId}${excludeUserId ? ` (excluded ${excludeUserId})` : ''}`,
    );
  }
}
