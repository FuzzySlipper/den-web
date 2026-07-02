import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { shellRoutes } from '@den-web/shell';
import { provideDenStoreKernel } from '@den-web/store';
import { AppComponent } from './app.component';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(shellRoutes), provideDenStoreKernel()],
}).catch((error: unknown) => {
  console.error(error);
});
