<?php

namespace Tests\Feature\Auth;

use App\Support\Permissions;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * A permission the frontend asks about but the backend never defines is
 * silently false — so the button, column or menu it guards simply never
 * appears, with no error anywhere to show for it. That is exactly how
 * renaming the permissions took the whole Products toolbar off the page:
 * the gates still said "products.manage" long after it stopped existing.
 *
 * This walks the frontend and fails if it references anything the
 * manifest does not define.
 */
class FrontendPermissionsMatchBackendTest extends TestCase
{
    /**
     * Every way the frontend names a permission.
     *
     * @return string[]
     */
    private function permissionsReferencedByFrontend(): array
    {
        $patterns = [
            // <Can permission="products.edit"> and permission='...'
            '/permission="([a-z\-]+\.[a-z\-]+)"/',
            "/permission='([a-z\-]+\.[a-z\-]+)'/",
            // can('products.edit')
            "/\bcan\('([a-z\-]+\.[a-z\-]+)'\)/",
            // guarded('products.view', <Page />)
            "/guarded\('([a-z\-]+\.[a-z\-]+)'/",
        ];

        $found = [];

        foreach ($this->frontendFiles() as $file) {
            $source = file_get_contents($file);

            foreach ($patterns as $pattern) {
                preg_match_all($pattern, $source, $matches);
                foreach ($matches[1] as $permission) {
                    $found[$permission][] = $file;
                }
            }

            // <CanAny permissions={['products.edit', 'products.delete']}>
            preg_match_all('/permissions=\{\[([^\]]+)\]\}/', $source, $lists);
            foreach ($lists[1] as $list) {
                preg_match_all("/'([a-z\-]+\.[a-z\-]+)'/", $list, $items);
                foreach ($items[1] as $permission) {
                    $found[$permission][] = $file;
                }
            }
        }

        return $found;
    }

    /**
     * @return string[]
     */
    private function frontendFiles(): array
    {
        $directory = new \RecursiveDirectoryIterator(resource_path('js'));
        $files = [];

        foreach (new \RecursiveIteratorIterator($directory) as $file) {
            if (in_array($file->getExtension(), ['ts', 'tsx'], true)) {
                $files[] = $file->getPathname();
            }
        }

        return $files;
    }

    public function test_every_permission_the_frontend_checks_exists_in_the_backend(): void
    {
        $referenced = $this->permissionsReferencedByFrontend();

        $this->assertNotEmpty($referenced, 'found no permission checks in the frontend — the patterns must have gone stale');

        $unknown = array_diff_key($referenced, array_flip(Permissions::all()));

        $this->assertSame([], $unknown, sprintf(
            "The frontend guards on permissions that do not exist, so whatever they protect is invisible:\n%s",
            implode("\n", array_map(
                fn (string $permission, array $files) => "  {$permission} — ".implode(', ', array_unique(array_map(
                    fn (string $file) => str_replace(resource_path('js').'/', '', $file),
                    $files,
                ))),
                array_keys($unknown),
                $unknown,
            )),
        ));
    }

    /**
     * The Products screen is the one that broke, so pin its controls
     * explicitly: an admin holds each of these, meaning the toolbar, the
     * row actions, the pricing dialog and the stock adjustment all render.
     */
    #[DataProvider('productScreenPermissions')]
    public function test_the_products_screen_controls_are_grantable(string $permission): void
    {
        $this->assertContains($permission, Permissions::all());
        $this->assertContains($permission, Permissions::forCompany());
    }

    /**
     * @return array<string, string[]>
     */
    public static function productScreenPermissions(): array
    {
        return [
            'new product button' => ['products.create'],
            'edit product' => ['products.edit'],
            'delete product' => ['products.delete'],
            'stock adjustment' => ['inventory.adjust'],
        ];
    }
}
