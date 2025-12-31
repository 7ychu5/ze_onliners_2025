// Created by Crowbar 0.71

// Stored modelname (without quotes): "ef_holysword_parryattack2.mdl"
$modelname "ef_holysword_swing.mdl"
$cd "."
$cdtexture "."
$cliptotextures
$scale 1.0

$bodygroup "studio"
{
	studio "ef_parrying_attack1"
}
$bodygroup "studio"
{
	studio "ef_parrying_attack2"
}
$bodygroup "studio"
{
	studio "ef_parrying_attack3"
}
$bodygroup "studio"
{
	studio "ef_parrying_attack4"
}
$bodygroup "studio"
{
	studio "ef_parrying_attack5"
}

$flags 0

$texrendermode "$0b_holysword_p.bmp" additive
$texrendermode "$0b_ef_holy_p_attack1.bmp" additive
$texrendermode "$0bef_charging.bmp" additive

$cbox 0 0 0 0 0 0

$bbox 0 0 0 0 0 0

$hbox 0 "holysword_p005" -4.7 -16.370001 0 4.7 16.370001 68.519997
$hbox 0 "holysword_p008" -4.7 -16.370001 0 4.7 16.370001 68.519997
$hbox 0 "holysword_p007" -4.7 -16.370001 0 4.7 16.370001 68.519997
$hbox 0 "holysword_p006" -4.7 -16.370001 0 4.7 16.370001 68.519997
$hbox 0 "holysword_p004" -4.7 -16.370001 0 4.7 16.370001 68.519997
$hbox 0 "holysword_p1" -4.7 -16.370001 0 4.7 16.370001 68.519997
$hbox 0 "holysword_p002" -4.7 -16.370001 0 4.7 16.370001 68.519997
$hbox 0 "holysword_p003" -4.7 -16.370001 0 4.7 16.370001 68.519997
$hbox 0 "Point_stack" -118.160004 -128.919998 -117.300003 0 0 117.989998

$sequence "idle" {
	"ef_holysword_swing_anims\idle"
	fps 30
}
