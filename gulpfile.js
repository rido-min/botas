import gulp from 'gulp';
import nbgv from 'nerdbank-gitversioning';

gulp.task('default', () => {
    return nbgv.setPackageVersion();
});