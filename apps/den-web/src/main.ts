import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ShellComponent, shellRoutes } from '@den-web/shell';
import { provideDenStoreKernel } from '@den-web/store';

bootstrapApplication(ShellComponent, {
  providers: [provideRouter(shellRoutes), provideDenStoreKernel()],
}).catch((error: unknown) => {
  console.error(error);
});
