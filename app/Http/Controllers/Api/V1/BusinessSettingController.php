<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateBusinessSettingsRequest;
use App\Http\Resources\BusinessSettingResource;
use App\Models\BusinessSetting;

class BusinessSettingController extends Controller
{
    public function show(): BusinessSettingResource
    {
        return new BusinessSettingResource(BusinessSetting::current());
    }

    public function update(UpdateBusinessSettingsRequest $request): BusinessSettingResource
    {
        $settings = BusinessSetting::current();
        $settings->update($request->validated());

        return new BusinessSettingResource($settings);
    }
}
