<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            // How many accounts this business may create. Null means no
            // ceiling — which is what every business already on the
            // platform keeps, so nobody is locked out by this shipping.
            $table->unsignedInteger('max_users')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn('max_users');
        });
    }
};
