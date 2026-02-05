use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("SKLstoreXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod skillstore {
    use super::*;

    /// Initialize the platform config (called once by admin)
    pub fn initialize(
        ctx: Context<Initialize>,
        fee_basis_points: u16,  // 500 = 5%
    ) -> Result<()> {
        require!(fee_basis_points <= 10000, SkillstoreError::InvalidFee);
        
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = ctx.accounts.treasury.key();
        config.fee_basis_points = fee_basis_points;
        config.total_sales = 0;
        config.total_fees_collected = 0;
        config.bump = ctx.bumps.config;
        
        emit!(ConfigInitialized {
            admin: config.admin,
            treasury: config.treasury,
            fee_basis_points,
        });
        
        Ok(())
    }

    /// Update treasury wallet (admin only)
    pub fn update_treasury(
        ctx: Context<UpdateConfig>,
        new_treasury: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.treasury = new_treasury;
        
        emit!(TreasuryUpdated {
            old_treasury: ctx.accounts.config.treasury,
            new_treasury,
        });
        
        Ok(())
    }

    /// Update fee percentage (admin only)
    pub fn update_fee(
        ctx: Context<UpdateConfig>,
        new_fee_basis_points: u16,
    ) -> Result<()> {
        require!(new_fee_basis_points <= 10000, SkillstoreError::InvalidFee);
        
        let config = &mut ctx.accounts.config;
        let old_fee = config.fee_basis_points;
        config.fee_basis_points = new_fee_basis_points;
        
        emit!(FeeUpdated {
            old_fee,
            new_fee: new_fee_basis_points,
        });
        
        Ok(())
    }

    /// List a skill for sale
    pub fn list_skill(
        ctx: Context<ListSkill>,
        skill_id: String,
        price_lamports: u64,
        metadata_uri: String,
    ) -> Result<()> {
        require!(skill_id.len() <= 32, SkillstoreError::SkillIdTooLong);
        require!(metadata_uri.len() <= 200, SkillstoreError::MetadataUriTooLong);
        require!(price_lamports > 0, SkillstoreError::InvalidPrice);
        
        let listing = &mut ctx.accounts.listing;
        listing.creator = ctx.accounts.creator.key();
        listing.skill_id = skill_id.clone();
        listing.price_lamports = price_lamports;
        listing.metadata_uri = metadata_uri;
        listing.total_sales = 0;
        listing.is_active = true;
        listing.created_at = Clock::get()?.unix_timestamp;
        listing.bump = ctx.bumps.listing;
        
        emit!(SkillListed {
            creator: listing.creator,
            skill_id,
            price_lamports,
        });
        
        Ok(())
    }

    /// Purchase a skill - splits payment between creator and treasury
    pub fn purchase_skill(ctx: Context<PurchaseSkill>) -> Result<()> {
        let listing = &ctx.accounts.listing;
        let config = &ctx.accounts.config;
        
        require!(listing.is_active, SkillstoreError::ListingNotActive);
        
        let price = listing.price_lamports;
        let fee = (price as u128)
            .checked_mul(config.fee_basis_points as u128)
            .unwrap()
            .checked_div(10000)
            .unwrap() as u64;
        let creator_amount = price.checked_sub(fee).unwrap();
        
        // Transfer fee to treasury
        if fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.buyer.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                fee,
            )?;
        }
        
        // Transfer remainder to creator
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.creator.to_account_info(),
                },
            ),
            creator_amount,
        )?;
        
        // Create purchase receipt
        let receipt = &mut ctx.accounts.receipt;
        receipt.buyer = ctx.accounts.buyer.key();
        receipt.skill_id = listing.skill_id.clone();
        receipt.creator = listing.creator;
        receipt.price_paid = price;
        receipt.fee_paid = fee;
        receipt.purchased_at = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.receipt;
        
        // Update listing stats
        let listing = &mut ctx.accounts.listing;
        listing.total_sales = listing.total_sales.checked_add(1).unwrap();
        
        // Update config stats
        let config = &mut ctx.accounts.config;
        config.total_sales = config.total_sales.checked_add(1).unwrap();
        config.total_fees_collected = config.total_fees_collected.checked_add(fee).unwrap();
        
        emit!(SkillPurchased {
            buyer: receipt.buyer,
            creator: receipt.creator,
            skill_id: receipt.skill_id.clone(),
            price: price,
            fee: fee,
        });
        
        Ok(())
    }

    /// Deactivate a listing (creator only)
    pub fn deactivate_listing(ctx: Context<DeactivateListing>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        listing.is_active = false;
        
        emit!(ListingDeactivated {
            skill_id: listing.skill_id.clone(),
            creator: listing.creator,
        });
        
        Ok(())
    }
}

// ============================================================================
// ACCOUNTS
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub fee_basis_points: u16,  // 500 = 5%, max 10000
    pub total_sales: u64,
    pub total_fees_collected: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub creator: Pubkey,
    #[max_len(32)]
    pub skill_id: String,
    pub price_lamports: u64,
    #[max_len(200)]
    pub metadata_uri: String,
    pub total_sales: u64,
    pub is_active: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Receipt {
    pub buyer: Pubkey,
    #[max_len(32)]
    pub skill_id: String,
    pub creator: Pubkey,
    pub price_paid: u64,
    pub fee_paid: u64,
    pub purchased_at: i64,
    pub bump: u8,
}

// ============================================================================
// CONTEXTS
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// CHECK: Treasury wallet to receive fees
    pub treasury: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        constraint = admin.key() == config.admin @ SkillstoreError::Unauthorized
    )]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
#[instruction(skill_id: String)]
pub struct ListSkill<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        init,
        payer = creator,
        space = 8 + Listing::INIT_SPACE,
        seeds = [b"listing", skill_id.as_bytes()],
        bump
    )]
    pub listing: Account<'info, Listing>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PurchaseSkill<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    /// CHECK: Creator receives payment
    #[account(mut)]
    pub creator: UncheckedAccount<'info>,
    
    /// CHECK: Treasury receives fee
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ SkillstoreError::InvalidTreasury
    )]
    pub treasury: UncheckedAccount<'info>,
    
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,
    
    #[account(
        mut,
        seeds = [b"listing", listing.skill_id.as_bytes()],
        bump = listing.bump,
        constraint = listing.creator == creator.key() @ SkillstoreError::InvalidCreator
    )]
    pub listing: Account<'info, Listing>,
    
    #[account(
        init,
        payer = buyer,
        space = 8 + Receipt::INIT_SPACE,
        seeds = [b"receipt", buyer.key().as_ref(), listing.skill_id.as_bytes()],
        bump
    )]
    pub receipt: Account<'info, Receipt>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeactivateListing<'info> {
    #[account(
        constraint = creator.key() == listing.creator @ SkillstoreError::Unauthorized
    )]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"listing", listing.skill_id.as_bytes()],
        bump = listing.bump
    )]
    pub listing: Account<'info, Listing>,
}

// ============================================================================
// EVENTS
// ============================================================================

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub fee_basis_points: u16,
}

#[event]
pub struct TreasuryUpdated {
    pub old_treasury: Pubkey,
    pub new_treasury: Pubkey,
}

#[event]
pub struct FeeUpdated {
    pub old_fee: u16,
    pub new_fee: u16,
}

#[event]
pub struct SkillListed {
    pub creator: Pubkey,
    pub skill_id: String,
    pub price_lamports: u64,
}

#[event]
pub struct SkillPurchased {
    pub buyer: Pubkey,
    pub creator: Pubkey,
    pub skill_id: String,
    pub price: u64,
    pub fee: u64,
}

#[event]
pub struct ListingDeactivated {
    pub skill_id: String,
    pub creator: Pubkey,
}

// ============================================================================
// ERRORS
// ============================================================================

#[error_code]
pub enum SkillstoreError {
    #[msg("Fee basis points must be <= 10000")]
    InvalidFee,
    #[msg("Skill ID must be <= 32 characters")]
    SkillIdTooLong,
    #[msg("Metadata URI must be <= 200 characters")]
    MetadataUriTooLong,
    #[msg("Price must be greater than 0")]
    InvalidPrice,
    #[msg("Listing is not active")]
    ListingNotActive,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
    #[msg("Invalid creator account")]
    InvalidCreator,
}


