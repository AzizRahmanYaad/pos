<?php

namespace App\Domain\Inventory\Actions;

use App\Models\Product;

/**
 * Keeps a product's listed sale price in step with its cost. When a
 * product is set to margin-based pricing, its sale_price is recomputed
 * from the current blended average cost plus the target margin every
 * time that cost changes — currently triggered right after a purchase is
 * received. Products left on fixed pricing are never touched.
 */
class ApplyAutoPricingAction
{
    public function execute(Product $product): void
    {
        if ($product->pricing_mode !== Product::PRICING_MARGIN || $product->margin_percent === null) {
            return;
        }

        $cost = $product->overallAverageCost();

        if ($cost <= 0) {
            return;
        }

        $newPrice = round($cost * (1 + ((float) $product->margin_percent) / 100), 2);

        if (abs($newPrice - (float) $product->sale_price) > 0.001) {
            $product->update(['sale_price' => $newPrice]);
        }
    }
}
