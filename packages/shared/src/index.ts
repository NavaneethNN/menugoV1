import { z } from 'zod';
import * as schemas from './schemas';

export * from './constants';
export * from './schemas';
export * from './order-state-machine';
export * from './realtime';

// Inferred TypeScript types
export type CreateRestaurantInput = z.infer<typeof schemas.createRestaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof schemas.updateRestaurantSchema>;
export type Restaurant = z.infer<typeof schemas.restaurantSchema>;

export type CreateCategoryInput = z.infer<typeof schemas.createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof schemas.updateCategorySchema>;
export type ReorderCategoriesInput = z.infer<typeof schemas.reorderCategoriesSchema>;
export type Category = z.infer<typeof schemas.categorySchema>;

export type CreateProductInput = z.infer<typeof schemas.createProductSchema>;
export type UpdateProductInput = z.infer<typeof schemas.updateProductSchema>;
export type ReorderProductsInput = z.infer<typeof schemas.reorderProductsSchema>;
export type Product = z.infer<typeof schemas.productSchema>;

export type CreateTableInput = z.infer<typeof schemas.createTableSchema>;
export type UpdateTableInput = z.infer<typeof schemas.updateTableSchema>;
export type RestaurantTable = z.infer<typeof schemas.restaurantTableSchema>;

export type CreateOrderItemInput = z.infer<typeof schemas.createOrderItemSchema>;
export type CreateOrderInput = z.infer<typeof schemas.createOrderSchema>;
export type PublicCreateOrderInput = z.infer<typeof schemas.publicCreateOrderSchema>;
export type PublicOrderItemInput = z.infer<typeof schemas.publicOrderItemSchema>;
export type UpdateOrderStatusInput = z.infer<typeof schemas.updateOrderStatusSchema>;
export type OrderItem = z.infer<typeof schemas.orderItemSchema>;
export type Order = z.infer<typeof schemas.orderSchema>;

export type AddMemberInput = z.infer<typeof schemas.addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof schemas.updateMemberRoleSchema>;
export type RestaurantMember = z.infer<typeof schemas.restaurantMemberSchema>;

export type InviteStaffInput = z.infer<typeof schemas.inviteStaffSchema>;
export type AddStaffInput = z.infer<typeof schemas.addStaffSchema>;
export type UpdateStaffRoleInput = z.infer<typeof schemas.updateStaffRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof schemas.transferOwnershipSchema>;
export type AcceptInvitationInput = z.infer<typeof schemas.acceptInvitationSchema>;
export type RestaurantInvitation = z.infer<typeof schemas.restaurantInvitationSchema>;
export type StaffAssignableRole = schemas.StaffAssignableRole;

export type CreateStaffWithPinInput = z.infer<typeof schemas.createStaffWithPinSchema>;
export type StaffPinLoginInput = z.infer<typeof schemas.staffPinLoginSchema>;
export type StaffPinCheckInput = z.infer<typeof schemas.staffPinCheckSchema>;
export type StaffSetPasswordInput = z.infer<typeof schemas.staffSetPasswordSchema>;
export type UpdateStaffPinInput = z.infer<typeof schemas.updateStaffPinSchema>;

export type CreateCinemaProfileInput = z.infer<typeof schemas.createCinemaProfileSchema>;
export type UpdateCinemaProfileInput = z.infer<typeof schemas.updateCinemaProfileSchema>;
export type CinemaProfile = z.infer<typeof schemas.cinemaProfileSchema>;
export type UpdateCinemaOnboardingStageInput = z.infer<typeof schemas.updateCinemaOnboardingStageSchema>;

export type CreateCinemaScreenInput = z.infer<typeof schemas.createCinemaScreenSchema>;
export type UpdateCinemaScreenInput = z.infer<typeof schemas.updateCinemaScreenSchema>;
export type CinemaScreen = z.infer<typeof schemas.cinemaScreenSchema>;

export type CreateCinemaRowInput = z.infer<typeof schemas.createCinemaRowSchema>;
export type UpdateCinemaRowInput = z.infer<typeof schemas.updateCinemaRowSchema>;
export type CinemaRow = z.infer<typeof schemas.cinemaRowSchema>;

export type CreateCinemaSeatInput = z.infer<typeof schemas.createCinemaSeatSchema>;
export type UpdateCinemaSeatInput = z.infer<typeof schemas.updateCinemaSeatSchema>;
export type CinemaSeat = z.infer<typeof schemas.cinemaSeatSchema>;
export type BatchCreateCinemaRowsInput = z.infer<typeof schemas.batchCreateCinemaRowsSchema>;

export type CreateCinemaMovieInput = z.infer<typeof schemas.createCinemaMovieSchema>;
export type UpdateCinemaMovieInput = z.infer<typeof schemas.updateCinemaMovieSchema>;
export type UpdateCinemaMoviePosterInput = z.infer<typeof schemas.updateCinemaMoviePosterSchema>;
export type CinemaMovie = z.infer<typeof schemas.cinemaMovieSchema>;

export type CreateCinemaShowInput = z.infer<typeof schemas.createCinemaShowSchema>;
export type UpdateCinemaShowInput = z.infer<typeof schemas.updateCinemaShowSchema>;
export type CancelCinemaShowInput = z.infer<typeof schemas.cancelCinemaShowSchema>;
export type CopyCinemaScheduleInput = z.infer<typeof schemas.copyCinemaScheduleSchema>;
export type CinemaShow = z.infer<typeof schemas.cinemaShowSchema>;

export type GenerateCinemaScreenQrInput = z.infer<typeof schemas.generateCinemaScreenQrSchema>;
export type RevokeCinemaQrInput = z.infer<typeof schemas.revokeCinemaQrSchema>;
export type CinemaQrCode = z.infer<typeof schemas.cinemaQrCodeSchema>;

export type CinemaCartItem = z.infer<typeof schemas.cinemaCartItemSchema>;
export type CinemaCartContext = z.infer<typeof schemas.cinemaCartContextSchema>;
export type AddCinemaCartItemInput = z.infer<typeof schemas.addCinemaCartItemSchema>;
export type UpdateCinemaCartItemQuantityInput = z.infer<typeof schemas.updateCinemaCartItemQuantitySchema>;
export type CalculateCinemaCheckoutInput = z.infer<typeof schemas.calculateCinemaCheckoutSchema>;
export type PrepareCinemaOrderInput = z.infer<typeof schemas.prepareCinemaOrderSchema>;

export type ConfigurePaymentProviderInput = z.infer<typeof schemas.configurePaymentProviderSchema>;
export type UpdatePaymentCredentialsInput = z.infer<typeof schemas.updatePaymentCredentialsSchema>;
export type CinemaPaymentAccount = z.infer<typeof schemas.cinemaPaymentAccountSchema>;
export type CinemaPaymentTransaction = z.infer<typeof schemas.cinemaPaymentTransactionSchema>;
export type InitiateCinemaRefundInput = z.infer<typeof schemas.initiateCinemaRefundSchema>;
export type CreateCinemaPaymentOrderInput = z.infer<typeof schemas.createCinemaPaymentOrderSchema>;
export type VerifyCinemaPaymentInput = z.infer<typeof schemas.verifyCinemaPaymentSchema>;








