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
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token as string, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Store socket ↔ user mapping
      const userId = payload.sub;
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      client.data.user = { userId, email: payload.email };

      this.logger.log(`User ${payload.email} connected (socket: ${client.id})`);
    } catch (err) {
      this.logger.error('Invalid WebSocket auth token');
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
    this.logger.log(`User disconnected (socket: ${client.id})`);
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
  }

  @SubscribeMessage('block_update')
  handleBlockUpdate(
    @MessageBody() data: { documentId: string; blockId: string; content: any },
    @ConnectedSocket() client: Socket,
  ) {
    client.broadcast.to(data.documentId).emit('block_updated', {
      blockId: data.blockId,
      content: data.content,
      updatedBy: client.data.user.userId,
      email: client.data.user.email,
    });
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
